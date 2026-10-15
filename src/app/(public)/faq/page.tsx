export const metadata = { title: "FAQ" };

const items = [
  ["Do I pay to create an account?", "No. Registration is free. Payment happens only after you submit a verification and choose a tier."],
  ["Where do you search?", "For Lagos, field officers search the Land Registry at Alausa, Ikeja, and the survey charting office when the tier includes it. The state record decides which registry applies."],
  ["Is the report a guarantee of title?", "No. It records what was found on the search date. It is not a guarantee of ownership and it is not a substitute for your own lawyer's advice."],
  ["Who can see my documents?", "Files stay in a private bucket. A signed link lasts 10 minutes, and every open is written to the audit log. Customers see progress, not staff notes."],
  ["Can I upload a phone photo?", "Yes. PDF, JPG, and PNG up to 20MB. You can preview a file and upload a replacement."],
  ["Which titles can you check?", "Certificate of Occupancy, including Global C of O, Governor's Consent, deeds, gazettes, survey plans, allocation letters, customary rights, judgments, and powers of attorney."],
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-4xl">Questions</h1>
      <dl className="mt-8 space-y-6">
        {items.map(([question, answer]) => (
          <div key={question}>
            <dt className="font-semibold">{question}</dt>
            <dd className="mt-1 text-ink-2">{answer}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
