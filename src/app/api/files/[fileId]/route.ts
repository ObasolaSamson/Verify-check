import { NextResponse } from "next/server";
import type { RoleKey } from "@prisma/client";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { canReadFile } from "@/server/files";
import { signedContentPath, storageDriver, supabaseSignedUrl } from "@/server/storage";
import { writeAudit } from "@/server/audit";

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const roles = (session.user.roles ?? []) as RoleKey[];
  if (!(await canReadFile(userId, roles, fileId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const file = await prisma.storedFile.findUniqueOrThrow({ where: { id: fileId } });
  await writeAudit({
    actorId: userId,
    action: "FILE_VIEWED",
    entityType: "StoredFile",
    entityId: fileId,
    metadata: { purpose: file.purpose },
  });

  const target =
    storageDriver() === "supabase"
      ? await supabaseSignedUrl(file.objectKey)
      : new URL(signedContentPath(fileId), request.url).toString();
  return NextResponse.redirect(target, { headers: { "Cache-Control": "no-store" } });
}
