"use server";

import { z } from "zod";
import { requireRole } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { writeAudit } from "@/server/audit";

const requestSchema = z.object({
  type: z.enum(["EXPORT", "DELETE"]),
  note: z.string().trim().max(2000).optional(),
});

export async function createDataRequestAction(input: unknown) {
  const user = await requireRole("CUSTOMER");
  const data = requestSchema.parse(input);
  const row = await prisma.dataSubjectRequest.create({
    data: {
      userId: user.id,
      type: data.type,
      note: data.note || null,
    },
  });
  await writeAudit({
    actorId: user.id,
    action: data.type === "EXPORT" ? "DATA_EXPORTED" : "DATA_DELETION_REQUESTED",
    entityType: "DataSubjectRequest",
    entityId: row.id,
  });
  return { ok: true as const };
}
