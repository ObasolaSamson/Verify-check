import Link from "next/link";
import { requireRole } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { formatNairaFromKobo } from "@/lib/money";

export const metadata = { title: "Payments" };

const date = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" });

export default async function PaymentsPage() {
  const user = await requireRole("CUSTOMER");
  const payments = await prisma.payment.findMany({
    where: { userId: user.id },
    include: { case: { select: { id: true, code: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">Payments</h1>
      {payments.length === 0 ? (
        <p className="text-ink-2">No payments yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-ink-2">
              <tr>
                <th className="p-3 font-semibold">Date</th>
                <th className="p-3 font-semibold">Case</th>
                <th className="p-3 font-semibold">Amount</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="p-3">{date.format(payment.createdAt)}</td>
                  <td className="p-3">
                    <Link href={`/dashboard/verifications/${payment.case.id}`} className="font-semibold text-seal">{payment.case.code}</Link>
                  </td>
                  <td className="p-3">{formatNairaFromKobo(payment.amountKobo)}</td>
                  <td className="p-3">{payment.status}</td>
                  <td className="p-3 font-mono text-xs">{payment.paystackReference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
