export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-12 text-sm leading-7">
      <p className="text-xs font-semibold uppercase tracking-wide text-brass">Draft for counsel review · Nigeria Data Protection Act 2023</p>
      <h1 className="font-serif text-4xl">Privacy policy</h1>
      <p>We collect your name, email, phone number, the property details you enter, the documents you upload, and payment references. We use them to create your account, run the verification, take payment, and contact you about the case.</p>
      <p>Account creation asks for consent to this policy and the terms. A verification asks for a separate consent to store that file. You can request a copy of your data or ask us to delete your account from the privacy page in your dashboard.</p>
      <p>National identification numbers and bank verification numbers, when we collect them later for agent checks, are stored encrypted. Screens show only the last four digits.</p>
      <p>Documents sit in a private store. Links expire after 10 minutes. We keep an append-only log of status changes, uploads, and document views.</p>
      <p>We keep case files for as long as we need them to defend the search, then delete or anonymise them. Payment records may be kept for accounting even after an account is closed.</p>
      <p>You can complain to the Nigeria Data Protection Commission if you believe we have handled your data unlawfully. Contact us through the address on your account before you do, so we can fix it.</p>
    </article>
  );
}
