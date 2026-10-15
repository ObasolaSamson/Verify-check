import Link from "next/link";
import type { CaseStatus } from "@prisma/client";
import { StatusBadge } from "@/features/cases/status-badge";
import { formatNairaFromKobo } from "@/lib/money";

export function CaseList({
  cases,
}: {
  cases: {
    id: string;
    code: string;
    status: CaseStatus;
    submittedAt: Date | null;
    priceKobo: number;
    createdAt: Date;
    tier: { name: string };
    property: { addressLine: string; lga: { name: string } };
  }[];
}) {
  if (cases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
        <p className="font-semibold">No verifications yet.</p>
        <Link href="/dashboard/verifications/new" className="mt-3 inline-block text-sm font-semibold text-seal">
          Start a verification
        </Link>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
      {cases.map((row) => (
        <li key={row.id}>
          <Link
            href={row.submittedAt ? `/dashboard/verifications/${row.id}` : `/dashboard/verifications/new?caseId=${row.id}`}
            className="flex flex-col gap-2 p-4 hover:bg-paper sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-semibold">{row.code}</p>
              <p className="text-sm text-ink-2">
                {row.property.addressLine}, {row.property.lga.name}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-ink-2">{row.tier.name} · {formatNairaFromKobo(row.priceKobo)}</span>
              <StatusBadge status={row.status} submittedAt={row.submittedAt} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
