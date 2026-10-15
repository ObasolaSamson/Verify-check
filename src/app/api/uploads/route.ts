import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { writeObject } from "@/server/storage";
import { writeAudit } from "@/server/audit";
import { rateLimit } from "@/lib/rate-limit";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);

function sniff(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const limit = rateLimit(`upload:${userId}`, 30, 10 * 60 * 1000);
  if (!limit.ok) return NextResponse.json({ error: "Too many uploads. Wait a few minutes." }, { status: 429 });

  const form = await request.formData();
  const file = form.get("file");
  const titleDocumentId = String(form.get("titleDocumentId") ?? "");
  if (!(file instanceof File) || !titleDocumentId) {
    return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files must be 20MB or smaller" }, { status: 413 });

  const document = await prisma.titleDocument.findUnique({
    where: { id: titleDocumentId },
    include: { case: true },
  });
  if (!document || document.case.customerId !== userId) {
    return NextResponse.json({ error: "That document could not be found" }, { status: 404 });
  }
  if (document.case.submittedAt) {
    return NextResponse.json({ error: "This request has already been submitted" }, { status: 409 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = sniff(bytes);
  if (!mimeType || !ALLOWED.has(mimeType)) {
    return NextResponse.json({ error: "Upload a PDF, JPG, or PNG" }, { status: 415 });
  }

  const objectKey = `cases/${document.caseId}/documents/${document.id}/${randomUUID()}.${ALLOWED.get(mimeType)}`;
  const stored = await writeObject(objectKey, bytes, mimeType);
  const originalName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 160) || `document.${ALLOWED.get(mimeType)}`;

  const row = await prisma.$transaction(async (tx) => {
    await tx.titleDocumentFile.updateMany({
      where: { titleDocumentId: document.id, supersededAt: null },
      data: { supersededAt: new Date() },
    });
    const saved = await tx.storedFile.create({
      data: {
        purpose: "TITLE_DOCUMENT",
        bucket: stored.bucket,
        objectKey,
        mimeType,
        sizeBytes: bytes.length,
        originalName,
        sha256: stored.sha256,
        uploadedById: userId,
      },
    });
    await tx.titleDocumentFile.create({ data: { titleDocumentId: document.id, fileId: saved.id } });
    return saved;
  });

  await writeAudit({
    actorId: userId,
    action: "FILE_UPLOADED",
    entityType: "StoredFile",
    entityId: row.id,
    metadata: { caseId: document.caseId, titleDocumentId: document.id, mimeType, sizeBytes: bytes.length },
  });

  return NextResponse.json({
    file: { id: row.id, name: row.originalName, mimeType: row.mimeType, previewPath: `/api/files/${row.id}` },
  });
}
