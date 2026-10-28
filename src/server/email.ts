import "server-only";

export type EmailResult = { ok: true; providerMessageId?: string } | { ok: false; error: string };

const RESEND_URL = "https://api.resend.com/emails";
// Resend's shared test sender. It only delivers to the email address that owns the Resend account.
const FALLBACK_FROM = "VerifyTitle Nigeria <onboarding@resend.dev>";

function hintFor(status: number, body: string) {
  const lower = body.toLowerCase();
  if (status === 401) return "The API key is invalid or was revoked. Create a new key in Resend and update RESEND_API_KEY.";
  if (lower.includes("not verified")) {
    return "The domain in EMAIL_FROM is not verified in Resend. Verify it under Resend > Domains, or send from onboarding@resend.dev while testing.";
  }
  if (lower.includes("testing emails") || lower.includes("your own email")) {
    return "Resend's test sender (onboarding@resend.dev) only delivers to the address that owns the Resend account. Verify a domain to email anyone.";
  }
  if (status === 403) return "Resend refused the request. Check that the API key has Sending access and that EMAIL_FROM uses a verified domain.";
  if (status === 422) return "Resend rejected the addresses. Check that EMAIL_FROM looks like: Name <address@your-domain.com>";
  if (status === 429) return "Resend rate limit reached. Wait a moment and try again.";
  return "";
}

/**
 * Sends one email through Resend (https://resend.com/docs/api-reference/emails/send-email).
 *
 * - If RESEND_API_KEY is set, the email is sent through Resend in every environment, including development.
 * - The sender comes from EMAIL_FROM.
 * - Failures are logged in full and returned to the caller. They are never swallowed.
 * - If RESEND_API_KEY is missing, production fails loudly. Development prints the email to the
 *   terminal so sign-up still works locally, with a warning that nothing was actually sent.
 */
export async function sendEmail(input: { to: string; subject: string; text: string; html?: string }): Promise<EmailResult> {
  const { to, subject, text, html } = input;
  const key = process.env.RESEND_API_KEY?.trim();

  if (!key) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        [
          "[email] NOT SENT: RESEND_API_KEY is not set in this environment.",
          `  to     : ${to}`,
          `  subject: ${subject}`,
          "  Fix    : add RESEND_API_KEY (and EMAIL_FROM) to the environment variables, then redeploy.",
        ].join("\n"),
      );
      return { ok: false, error: "Email is not configured (RESEND_API_KEY is missing)" };
    }
    console.warn(
      [
        "[email] RESEND_API_KEY is not set, so NO email was sent. Printing it here instead (development only).",
        `  to     : ${to}`,
        `  subject: ${subject}`,
        "  ----",
        text,
        "  ----",
        "  To send for real, set RESEND_API_KEY and EMAIL_FROM in .env.local and restart `npm run dev`.",
      ].join("\n"),
    );
    return { ok: true, providerMessageId: "dev-log" };
  }

  const configuredFrom = process.env.EMAIL_FROM?.trim();
  if (!configuredFrom) {
    console.warn(`[email] EMAIL_FROM is not set. Falling back to ${FALLBACK_FROM}, which only delivers to your own Resend account email.`);
  }
  const from = configuredFrom || FALLBACK_FROM;

  let response: Response;
  try {
    response = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, ...(html ? { html } : {}) }),
    });
  } catch (error) {
    console.error(
      [
        "[email] Could not reach Resend (network error). The email was NOT sent.",
        `  to     : ${to}`,
        `  from   : ${from}`,
        `  subject: ${subject}`,
        "  error  :",
      ].join("\n"),
      error,
    );
    return { ok: false, error: "Could not reach the email provider" };
  }

  const raw = await response.text();
  if (!response.ok) {
    const hint = hintFor(response.status, raw);
    console.error(
      [
        "[email] Resend REJECTED the email. It was NOT sent.",
        `  status : ${response.status} ${response.statusText}`,
        `  to     : ${to}`,
        `  from   : ${from}`,
        `  subject: ${subject}`,
        `  body   : ${raw}`,
        ...(hint ? [`  hint   : ${hint}`] : []),
      ].join("\n"),
    );
    return { ok: false, error: `Resend ${response.status}: ${raw}` };
  }

  let id: string | undefined;
  try {
    id = (JSON.parse(raw) as { id?: string }).id;
  } catch {
    // A successful response without JSON is unusual but not a failure.
  }
  console.info(`[email] Sent via Resend to ${to} (id ${id ?? "unknown"}, from ${from})`);
  return { ok: true, providerMessageId: id };
}
