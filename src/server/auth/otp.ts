import { createHash, randomInt } from "crypto";
import type { OtpChannel } from "@prisma/client";
import { hashOtp, safeEqual } from "@/lib/crypto";
import { prisma } from "@/server/db";
import { sendEmail } from "@/server/email";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function devCode() {
  return process.env.NODE_ENV === "development" ? process.env.DEV_OTP_CODE : undefined;
}

export function newOtpCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function createChallenge(input: {
  userId?: string | null;
  channel: OtpChannel;
  destination: string;
  ttlMs?: number;
  code?: string;
}) {
  const code = input.code ?? newOtpCode();
  await prisma.otpChallenge.create({
    data: {
      userId: input.userId ?? null,
      channel: input.channel,
      destination: input.destination,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + (input.ttlMs ?? OTP_TTL_MS)),
    },
  });
  return code;
}

export async function verifyChallenge(destination: string, code: string) {
  const challenge = await prisma.otpChallenge.findFirst({
    where: { destination, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return { ok: false as const, reason: "expired" as const };
  if (challenge.attempts >= MAX_ATTEMPTS) return { ok: false as const, reason: "locked" as const };

  const master = devCode();
  const matches = safeEqual(challenge.codeHash, hashOtp(code)) || (master !== undefined && master.length > 0 && safeEqual(hashOtp(code), hashOtp(master)));
  if (!matches) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false as const, reason: "mismatch" as const };
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true as const, userId: challenge.userId, channel: challenge.channel };
}

/** Check a code without consuming it, so a second channel can still be confirmed. */
export async function peekChallenge(destination: string, code: string) {
  const challenge = await prisma.otpChallenge.findFirst({
    where: { destination, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.attempts >= MAX_ATTEMPTS) return false;
  const master = devCode();
  return (
    safeEqual(challenge.codeHash, hashOtp(code)) ||
    (master !== undefined && master.length > 0 && code === master)
  );
}

export async function deliverOtp(input: { channel: OtpChannel; destination: string; code: string; name?: string | null }) {
  const text = `Your VerifyTitle Nigeria code is ${input.code}. It expires in 10 minutes.`;
  if (input.channel === "EMAIL") return sendEmail({ to: input.destination, subject: "Your VerifyTitle Nigeria code", text });
  return sendSms(input.destination, text);
}

async function sendSms(to: string, sms: string) {
  const key = process.env.TERMII_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[verifytitle sms] to=${to}\n${sms}`);
      return { ok: true, providerMessageId: "dev-log" };
    }
    return { ok: false, error: "SMS provider is not configured" };
  }
  const response = await fetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      to: to.replace("+", ""),
      from: process.env.TERMII_SENDER_ID || "VerifyTitle",
      sms,
      type: "plain",
      channel: "generic",
    }),
  });
  if (!response.ok) return { ok: false, error: await response.text() };
  const body = (await response.json()) as { message_id?: string };
  return { ok: true, providerMessageId: body.message_id };
}

export function ticketDestination(userId: string) {
  return `ticket:${userId}`;
}

export function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}
