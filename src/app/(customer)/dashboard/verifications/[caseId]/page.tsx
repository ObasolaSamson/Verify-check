import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/server/auth/rbac";
import { CaseError, getOwnedCase } from "@/server/cases/requests";
import { devPaymentAllowed, paystackConfigured } from "@/server/paystack";
import { startPaymentAction, simulateDevPaymentAction } from "@/features/payments/actions";
import { StatusBadge } from "@/features/cases/status-badge";
import { Button } from "@/components/ui/button";
import { DOCUMENT_LABELS, RELATIONSHIP_LABELS } from "@/lib/labels";
import { formatNairaFromKobo, turnaroundLabel } from "@/lib/money";
import { maskPhone } from "@/lib/phone";

const ERRORS: Record<string, string> = {
  paystack: "Payments are not configured on this server yet. Add PAYSTACK_SECRET_KEY to take card payments.",
  payment: "Paystack could not start the payment. Try again in a moment.",
  email: "Add an email to your account before you pay. Paystack needs one for the receipt.",
};

const dateTime = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ error?: string; paid?: string }>;
}) {
  const user = await requireRole("CUSTOMER");
  const { caseId } = await params;
  const { error, paid } = await searchParams;

  let row;
  try {
    row = await getOwnedCase(user.id, caseId);
  } catch (caught) {
    if (caught instanceof CaseError) notFound();
    throw caught;
  }
  if (!row.submittedAt) redirect(`/dashboard/verifications/new?caseId=${row.id}`);

  const awaitingPayment = row.status === "PENDING_PAYMENT";
  const pendingAttempt = row.payments.find((payment) => payment.status === "PENDING");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-8">
        <div>
          <Link href="/dashboard/verifications" className="text-sm font-semibold text-seal">← My verifications</Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-4xl">{row.code}</h1>
            <StatusBadge status={row.status} submittedAt={row.submittedAt} />
          </div>
          <p className="mt-1 text-ink-2">
            {row.property.addressLine}, {row.property.lga.name}, {row.property.state.name}
          </p>
        </div>

        {error && ERRORS[error] ? <p className="rounded-md bg-[#f8e6e3] px-3 py-2 text-sm text-risk">{ERRORS[error]}</p> : null}
        {paid ? <p className="rounded-md bg-seal-wash px-3 py-2 text-sm text-seal-dark">Payment confirmed. The case is in the queue.</p> : null}

        <section className="space-y-3">
          <h2 className="font-serif text-2xl">Progress</h2>
          <ol className="space-y-4 border-l-2 border-line pl-5">
            {row.events.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 size-3 rounded-full bg-seal" />
                <p className="font-semibold">{event.title}</p>
                {event.detail ? <p className="text-sm text-ink-2">{event.detail}</p> : null}
                <p className="text-xs text-ink-3">{dateTime.format(event.createdAt)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-2xl">Checks in the {row.tier.name} tier</h2>
          <p className="text-sm text-ink-2">Staff are assigned to each check once payment clears. Live progress per check arrives in the next release.</p>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {row.tier.checks.map((check) => (
              <li key={check.id} className="p-4">
                <p className="font-semibold">{check.title}</p>
                <p className="text-sm text-ink-2">{check.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-2xl">Documents</h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {row.documents.map((document) => {
              const current = document.files.find((file) => !file.supersededAt);
              return (
                <li key={document.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">
                      {document.documentType === "OTHER" ? document.otherTypeLabel : DOCUMENT_LABELS[document.documentType]}
                      {document.isGlobalCofO ? " (Global)" : ""}
                    </p>
                    <p className="text-sm text-ink-2">
                      {document.nameOnDocument}
                      {document.registrationNumber ? ` · No. ${document.registrationNumber}` : ""}
                      {document.volume ? ` · Vol. ${document.volume}` : ""}
                      {document.page ? ` p. ${document.page}` : ""}
                    </p>
                  </div>
                  {current ? (
                    <a href={`/api/files/${current.fileId}`} className="text-sm font-semibold text-seal">Open file</a>
                  ) : (
                    <span className="text-sm text-ink-3">No file</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-sm text-ink-2">{row.tier.name}</p>
          <p className="font-serif text-3xl">{formatNairaFromKobo(row.priceKobo)}</p>
          <p className="text-sm text-ink-2">{turnaroundLabel(row.turnaroundMinDays, row.turnaroundMaxDays)} after payment</p>
          {awaitingPayment ? (
            <div className="mt-4 space-y-3">
              <form action={startPaymentAction}>
                <input type="hidden" name="caseId" value={row.id} />
                <Button type="submit" className="w-full" disabled={!paystackConfigured()}>
                  Pay with Paystack
                </Button>
              </form>
              {devPaymentAllowed() ? (
                <form action={simulateDevPaymentAction}>
                  <input type="hidden" name="caseId" value={row.id} />
                  <Button type="submit" variant="outline" className="w-full">
                    Mark paid (development only)
                  </Button>
                </form>
              ) : null}
              {pendingAttempt ? <p className="text-xs text-ink-3">A payment was started. If you paid, this page updates once Paystack confirms it.</p> : null}
              <p className="text-xs text-ink-3">The search starts only after Paystack confirms the fee on our server.</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-seal-dark">Paid {row.paidAt ? dateTime.format(row.paidAt) : ""}</p>
          )}
        </div>
        <div className="rounded-lg border border-line bg-surface p-5 text-sm">
          <p className="font-semibold">Document contact</p>
          <p>{row.contactName}</p>
          <p className="text-ink-2">{RELATIONSHIP_LABELS[row.contactRelationship]}</p>
          <p className="text-ink-2">{maskPhone(row.contactPhone)}</p>
        </div>
      </aside>
    </div>
  );
}
