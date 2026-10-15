import { prisma } from "@/server/db";

export async function allocateCaseCode(stateCode: string) {
  const year = new Date().getFullYear();
  const rows = await prisma.$queryRaw<Array<{ lastValue: number }>>`
    INSERT INTO "CaseCounter" ("stateCode", "year", "lastValue")
    VALUES (${stateCode}, ${year}, 1)
    ON CONFLICT ("stateCode", "year")
    DO UPDATE SET "lastValue" = "CaseCounter"."lastValue" + 1
    RETURNING "lastValue"
  `;
  const value = Number(rows[0]?.lastValue ?? 0);
  return `TC-${stateCode}-${year}-${String(value).padStart(6, "0")}`;
}
