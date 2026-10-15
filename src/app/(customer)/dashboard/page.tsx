import Link from "next/link";
import { requireRole } from "@/server/auth/rbac";
import { listCustomerCases } from "@/server/cases/requests";
import { CaseList } from "@/features/cases/case-list";

export default async function DashboardPage() {
  const user = await requireRole("CUSTOMER");
  const cases = await listCustomerCases(user.id);
  const awaiting = cases.filter((row) => row.status === "PENDING_PAYMENT" && row.submittedAt).length;
  const active = cases.filter((row) => ["PAID", "ASSIGNED", "IN_PROGRESS", "UNDER_REVIEW", "ON_HOLD"].includes(row.status)).length;
  const completed = cases.filter((row) => row.status === "COMPLETED").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Welcome, {user.name?.split(" ")[0] ?? "there"}</h1>
          <p className="mt-1 text-ink-2">Your account is free. Each verification is paid separately when you submit it.</p>
        </div>
        <Link href="/dashboard/verifications/new" className="rounded-md bg-seal px-4 py-3 text-sm font-semibold text-paper">
          New verification
        </Link>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ["Awaiting payment", awaiting],
          ["In progress", active],
          ["Completed", completed],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-surface p-4">
            <dt className="text-sm text-ink-2">{label}</dt>
            <dd className="mt-1 font-serif text-3xl">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Recent verifications</h2>
        <CaseList cases={cases.slice(0, 5)} />
      </section>
    </div>
  );
}
