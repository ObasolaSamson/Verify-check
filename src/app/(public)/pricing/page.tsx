import Link from "next/link";
import { loadWizardOptions } from "@/server/cases/requests";
import { formatNairaFromKobo, turnaroundLabel } from "@/lib/money";

export const metadata = { title: "Pricing" };

export default async function PricingPage() {
  const states = await loadWizardOptions();
  const lagos = states[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-serif text-4xl">Lagos verification fees</h1>
      <p className="mt-3 max-w-2xl text-ink-2">
        Prices and turnaround live in the database, per state. An administrator can change them without a code release. You choose a tier after the documents are uploaded, and you pay on the case page.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {lagos?.tierFees.map((fee) => (
          <article key={fee.tierId} className="flex flex-col rounded-lg border border-line bg-surface p-5">
            <h2 className="font-serif text-3xl">{fee.tier.name}</h2>
            <p className="mt-2 text-2xl font-semibold">{formatNairaFromKobo(fee.priceKobo)}</p>
            <p className="text-sm text-ink-2">{turnaroundLabel(fee.turnaroundMinDays, fee.turnaroundMaxDays)}</p>
            <p className="mt-3 text-sm">{fee.tier.description}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {fee.tier.checks.map((check) => (
                <li key={check.id}>
                  <span className="font-semibold">{check.title}.</span> {check.description}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <Link href="/register" className="mt-8 inline-flex rounded-md bg-seal px-4 py-3 text-sm font-semibold text-paper">
        Create a free account
      </Link>
    </div>
  );
}
