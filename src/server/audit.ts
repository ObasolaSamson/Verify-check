import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requestMeta } from "@/server/request-meta";

export async function writeAudit(input: {
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const meta = await requestMeta().catch(() => ({ ipAddress: null, userAgent: null }));
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });
}
