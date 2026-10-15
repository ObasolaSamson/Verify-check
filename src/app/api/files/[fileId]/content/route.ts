import { Readable } from "stream";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { openLocalObject, storageDriver, verifyContentSignature } from "@/server/storage";

/** Serves local development files behind the same 10-minute signature Supabase uses. */
export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  if (storageDriver() !== "local") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { fileId } = await context.params;
  const url = new URL(request.url);
  const exp = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("sig") ?? "";
  if (!verifyContentSignature(fileId, exp, sig)) {
    return NextResponse.json({ error: "This link has expired" }, { status: 403 });
  }
  const file = await prisma.storedFile.findUnique({ where: { id: fileId } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stream = Readable.toWeb(openLocalObject(file.objectKey)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `inline; filename="${file.originalName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
