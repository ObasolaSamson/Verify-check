import type { RoleKey } from "@prisma/client";
import { prisma } from "@/server/db";

export async function canReadFile(userId: string, roles: RoleKey[], fileId: string) {
  if (roles.includes("ADMIN")) return true;
  const file = await prisma.storedFile.findUnique({ where: { id: fileId } });
  if (!file) return false;
  if (file.uploadedById === userId) return true;

  const document = await prisma.titleDocumentFile.findFirst({
    where: { fileId },
    include: { titleDocument: { select: { case: { select: { customerId: true } } } } },
  });
  if (document?.titleDocument.case.customerId === userId) return true;

  const evidence = await prisma.evidence.findFirst({
    where: { fileId },
    include: { task: { select: { case: { select: { customerId: true } }, assigneeId: true } } },
  });
  if (evidence && (evidence.task.case.customerId === userId || evidence.task.assigneeId === userId)) return true;

  const photo = await prisma.sitePhoto.findFirst({
    where: { fileId },
    include: { case: { select: { customerId: true } }, task: { select: { assigneeId: true } } },
  });
  if (photo && (photo.case.customerId === userId || photo.task.assigneeId === userId)) return true;

  return false;
}
