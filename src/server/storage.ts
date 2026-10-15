import { createReadStream } from "fs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { sha256 } from "@/server/auth/otp";
import { signPayload, safeEqual } from "@/lib/crypto";

const URL_TTL_SECONDS = 10 * 60;

export function storageRoot() {
  return path.join(process.cwd(), ".data", "uploads");
}

export function storageDriver() {
  return process.env.STORAGE_DRIVER === "supabase" ? "supabase" : "local";
}

export async function writeObject(objectKey: string, bytes: Buffer, mimeType: string) {
  if (storageDriver() === "supabase") {
    const base = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.STORAGE_BUCKET || "titlecheck-private";
    if (!base || !key) throw new Error("Supabase storage is not configured");
    const response = await fetch(`${base}/storage/v1/object/${bucket}/${objectKey}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": mimeType,
        "x-upsert": "false",
      },
      body: new Uint8Array(bytes),
    });
    if (!response.ok) throw new Error(`Storage upload failed: ${response.status}`);
    return { bucket, sha256: sha256(bytes) };
  }

  const root = storageRoot();
  const dest = path.resolve(root, objectKey);
  if (!dest.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, bytes);
  return { bucket: "local", sha256: sha256(bytes) };
}

export function openLocalObject(objectKey: string) {
  const root = storageRoot();
  const dest = path.resolve(root, objectKey);
  if (!dest.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return createReadStream(dest);
}

export function signedContentPath(fileId: string) {
  const exp = Math.floor(Date.now() / 1000) + URL_TTL_SECONDS;
  const sig = signPayload(`${fileId}.${exp}`);
  return `/api/files/${fileId}/content?exp=${exp}&sig=${sig}`;
}

export function verifyContentSignature(fileId: string, exp: string, sig: string) {
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  const expected = signPayload(`${fileId}.${expires}`);
  return safeEqual(expected, sig);
}

export async function supabaseSignedUrl(objectKey: string) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.STORAGE_BUCKET || "titlecheck-private";
  if (!base || !key) throw new Error("Supabase storage is not configured");
  const response = await fetch(`${base}/storage/v1/object/sign/${bucket}/${objectKey}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: URL_TTL_SECONDS }),
  });
  if (!response.ok) throw new Error("Could not sign the file URL");
  const body = (await response.json()) as { signedURL?: string };
  if (!body.signedURL) throw new Error("Could not sign the file URL");
  return body.signedURL.startsWith("http") ? body.signedURL : `${base}/storage/v1${body.signedURL}`;
}
