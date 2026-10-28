import { createHash, randomBytes } from "crypto";
import { prisma } from "@/server/db";
import { appUrl } from "@/lib/utils";

export const EMAIL_LINK_TTL_MS = 24 * 60 * 60 * 1000;

const PREFIX = "email-verify:";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Creates a confirmation link that is valid for 24 hours. Only a hash of the token is stored, so a
 * database leak does not expose working links. Sending a new link replaces the previous one.
 */
export async function createEmailVerificationLink(email: string) {
  const identifier = `${PREFIX}${email.trim().toLowerCase()}`;
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { OR: [{ identifier }, { expires: { lt: new Date() } }] } }),
    prisma.verificationToken.create({
      data: { identifier, token: hashToken(token), expires: new Date(Date.now() + EMAIL_LINK_TTL_MS) },
    }),
  ]);
  return `${appUrl().replace(/\/$/, "")}/verify/confirm?token=${token}`;
}

export type ConfirmResult =
  | { status: "confirmed" | "already"; email: string }
  | { status: "expired"; email: string }
  | { status: "invalid" };

/**
 * Confirms the email address behind a link. The token is not used up, so email scanners that open the
 * link before the person does cannot break it. Confirming twice does nothing, and the link stops working at expiry.
 */
export async function confirmEmailToken(token: string): Promise<ConfirmResult> {
  if (!token || token.length > 200) return { status: "invalid" };
  const row = await prisma.verificationToken.findFirst({
    where: { token: hashToken(token), identifier: { startsWith: PREFIX } },
  });
  if (!row) return { status: "invalid" };

  const email = row.identifier.slice(PREFIX.length);
  if (row.expires.getTime() < Date.now()) {
    await prisma.verificationToken.deleteMany({ where: { identifier: row.identifier } });
    return { status: "expired", email };
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user || user.anonymizedAt) return { status: "invalid" };
  if (user.emailVerified) return { status: "already", email };

  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  return { status: "confirmed", email };
}
