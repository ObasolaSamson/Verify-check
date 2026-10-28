import { sendEmail } from "@/server/email";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The email sent at sign-up: a confirmation link (valid 24 hours) and the 6-digit code (valid 10 minutes). */
export function sendSignupEmail(input: { to: string; name?: string | null; code: string; link: string }) {
  const first = input.name?.trim().split(/\s+/)[0];
  const greeting = first ? `Hi ${first},` : "Hi,";
  const subject = "Confirm your VerifyTitle Nigeria email";

  const text = [
    greeting,
    "",
    "Confirm your email to finish creating your VerifyTitle Nigeria account:",
    input.link,
    "This link works for 24 hours.",
    "",
    `Or enter this code on the sign-up page: ${input.code}`,
    "The code expires in 10 minutes.",
    "",
    "If you did not create this account, you can ignore this email.",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f4ee;font-family:Arial,Helvetica,sans-serif;color:#1c1c1c;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px;">
      <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">Confirm your email to finish creating your VerifyTitle Nigeria account.</p>
      <p style="margin:0 0 24px;">
        <a href="${input.link}" style="display:inline-block;background:#1f5d4a;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px;">Confirm my email</a>
      </p>
      <p style="margin:0 0 20px;font-size:13px;color:#555;">This link works for 24 hours. If the button does not work, paste this into your browser:<br><a href="${input.link}" style="color:#1f5d4a;word-break:break-all;">${input.link}</a></p>
      <p style="margin:0 0 6px;font-size:14px;">Or enter this code on the sign-up page:</p>
      <p style="margin:0 0 6px;font-size:28px;letter-spacing:6px;font-weight:bold;">${escapeHtml(input.code)}</p>
      <p style="margin:0 0 20px;font-size:13px;color:#555;">The code expires in 10 minutes.</p>
      <p style="margin:0;font-size:12px;color:#777;">If you did not create this account, you can ignore this email.</p>
    </div>
  </body>
</html>`;

  return sendEmail({ to: input.to, subject, text, html });
}
