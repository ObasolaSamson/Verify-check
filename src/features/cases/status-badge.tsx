import type { CaseStatus } from "@prisma/client";
import { caseStatusLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

const tone: Partial<Record<CaseStatus, string>> = {
  PENDING_PAYMENT: "bg-brass-wash text-caution",
  COMPLETED: "bg-seal-wash text-seal-dark",
  ON_HOLD: "bg-brass-wash text-caution",
  CANCELLED: "bg-[#f8e6e3] text-risk",
  REFUNDED: "bg-[#f8e6e3] text-risk",
};

export function StatusBadge({ status, submittedAt }: { status: CaseStatus; submittedAt: Date | null }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", tone[status] ?? "bg-[#e4ebf5] text-[#26508c]")}>
      {caseStatusLabel(status, submittedAt)}
    </span>
  );
}
