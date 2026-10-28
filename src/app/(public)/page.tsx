import Link from "next/link";
import { loadWizardOptions } from "@/server/cases/requests";
import { formatNairaFromKobo, turnaroundLabel } from "@/lib/money";

export default async function HomePage() {
  const states = await loadWizardOptions();
  const lagos = states[0];

  return (
    <div>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brass">Lagos first. Built for every state.</p>
          <h1 className="mt-3 font-serif text-5xl leading-tight text-ink sm:text-6xl">Check the title before you pay.</h1>
          <p className="mt-5 max-w-xl text-lg text-ink-2">
            Fake certificates of occupancy, missing Governor's Consent, and land under government acquisition still change hands in Nigeria.
            VerifyTitle Nigeria sends field officers to the registry, surveyors to chart the plan, and a lawyer to write the opinion.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-md bg-seal px-4 py-3 text-sm font-semibold text-paper">
              Create a free account
            </Link>
            <Link href="/pricing" className="rounded-md border border-line-strong bg-surface px-4 py-3 text-sm font-semibold">
              See Lagos fees
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink-2">No payment to sign up. You pay only when you submit a verification.</p>
        </div>
        <aside className="rounded-lg border border-line bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Case</p>
          <p className="mt-1 font-serif text-2xl">TC-LAG-2026-000123</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-ink-2">Registry</dt><dd>Lagos Land Registry, Alausa</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-2">Status</dt><dd>Search in progress</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-2">What you see</dt><dd>Progress, not internal notes</dd></div>
          </dl>
        </aside>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 md:grid-cols-3">
          {[
            ["Fake C of Os", "A document can look registered and still not be in the file at Alausa. We search the registry and keep the receipt."],
            ["Acquisition and setback", "A survey can sit inside government acquisition, a committed layout, or a right of way. Charting is a separate check."],
            ["Omonile and family land", "Community claims do not show on a certificate. Higher tiers include neighbour and family checks, then a legal opinion."],
          ].map(([title, body]) => (
            <article key={title}>
              <h2 className="font-serif text-2xl">{title}</h2>
              <p className="mt-2 text-sm text-ink-2">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="font-serif text-3xl">How a case moves</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            ["1", "You describe the land and upload the documents."],
            ["2", "You pay the tier fee. The search starts after Paystack confirms it."],
            ["3", "Our team searches, charts, and where the tier includes it, visits the site."],
            ["4", "A lawyer reviews the file. You get the report, with a code you can show anyone."],
          ].map(([n, text]) => (
            <li key={n} className="rounded-lg border border-line bg-surface p-4">
              <p className="font-serif text-3xl text-seal">{n}</p>
              <p className="mt-2 text-sm">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {lagos ? (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <h2 className="font-serif text-3xl">Lagos fees</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {lagos.tierFees.map((fee) => (
              <article key={fee.tierId} className="rounded-lg border border-line bg-surface p-5">
                <h3 className="font-serif text-2xl">{fee.tier.name}</h3>
                <p className="mt-1 text-lg font-semibold">{formatNairaFromKobo(fee.priceKobo)}</p>
                <p className="text-sm text-ink-2">{turnaroundLabel(fee.turnaroundMinDays, fee.turnaroundMaxDays)}</p>
                <p className="mt-3 text-sm">{fee.tier.description}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
