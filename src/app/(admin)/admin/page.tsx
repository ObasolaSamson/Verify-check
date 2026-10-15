import { AppShell } from "@/components/layout/app-shell";
import { requireRole } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { STATUS_LABELS } from "@/lib/labels";
import { formatNairaFromKobo } from "@/lib/money";

export default async function AdminHome() {
  const user = await requireRole("ADMIN");
  const [byStatus, revenue] = await Promise.all([
    prisma.verificationCase.groupBy({ by: ["status"], _count: true }),
    prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amountKobo: true } }),
  ]);
  return (
    <AppShell title="Admin" user={user} links={[{ href: "/admin", label: "Overview" }]}>
      <h1 className="font-serif text-4xl">Admin</h1>
      <p className="mt-2 text-ink-2">Case assignment, tier settings, and the audit log arrive in Phase 2.</p>
      <p className="mt-6 text-sm text-ink-2">Revenue collected</p>
      <p className="font-serif text-3xl">{formatNairaFromKobo(revenue._sum.amountKobo ?? 0)}</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {byStatus.map((row) => (
          <li key={row.status} className="rounded-lg border border-line bg-surface p-4">
            <p className="text-sm text-ink-2">{STATUS_LABELS[row.status]}</p>
            <p className="font-serif text-2xl">{row._count}</p>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
