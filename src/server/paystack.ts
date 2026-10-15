import { createHmac } from "crypto";
import { prisma } from "@/server/db";
import { safeEqual } from "@/lib/crypto";
import { appUrl } from "@/lib/utils";
import { writeAudit } from "@/server/audit";

type PaystackInit = {
  status: boolean;
  message: string;
  data?: { authorization_url: string; access_code: string; reference: string };
};

type PaystackVerify = {
  status: boolean;
  data?: {
    status: string;
    amount: number;
    currency: string;
    reference: string;
    channel?: string;
    id?: number;
  };
};

export function paystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

export function devPaymentAllowed() {
  return process.env.NODE_ENV === "development" && !paystackConfigured();
}

function secret() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Paystack is not configured");
  return key;
}

export function verifyPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const digest = createHmac("sha512", secret()).update(rawBody).digest("hex");
  return safeEqual(digest, signature);
}

export async function initializePaystack(input: { email: string; amountKobo: number; reference: string; caseId: string }) {
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      reference: input.reference,
      currency: "NGN",
      callback_url: `${appUrl()}/payments/callback`,
      metadata: { caseId: input.caseId, custom_fields: [] },
    }),
  });
  const body = (await response.json()) as PaystackInit;
  if (!response.ok || !body.status || !body.data) {
    throw new Error(body.message || "Paystack could not start the payment");
  }
  return body.data;
}

export async function verifyPaystackTransaction(reference: string) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret()}` },
    cache: "no-store",
  });
  const body = (await response.json()) as PaystackVerify;
  if (!response.ok || !body.status || !body.data) return null;
  return body.data;
}

/** Marks a case paid only after the Paystack amount matches the snapshotted fee. */
export async function settleVerifiedPayment(input: {
  reference: string;
  amountKobo: number;
  currency: string;
  status: string;
  channel?: string;
}) {
  const payment = await prisma.payment.findUnique({
    where: { paystackReference: input.reference },
    include: { case: true },
  });
  if (!payment) return { ok: false as const, reason: "unknown" };
  if (payment.status === "SUCCESS") return { ok: true as const, caseId: payment.caseId, already: true };

  const amountMatches = input.amountKobo === payment.amountKobo && input.currency === "NGN";
  const paid = input.status === "success" && amountMatches;
  if (!paid) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failureReason: amountMatches ? `Paystack status ${input.status}` : "Amount did not match the case fee",
      },
    });
    return { ok: false as const, reason: "rejected", caseId: payment.caseId };
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCESS", channel: input.channel, paidAt: new Date(), failureReason: null },
    }),
    prisma.verificationCase.update({
      where: { id: payment.caseId },
      data: { status: "PAID", paidAt: new Date() },
    }),
    prisma.caseEvent.create({
      data: {
        caseId: payment.caseId,
        actorId: payment.userId,
        status: "PAID",
        title: "Payment received",
        detail: "The verification is in the queue. A field officer will be assigned next.",
        customerVisible: true,
      },
    }),
  ]);

  await writeAudit({
    actorId: payment.userId,
    action: "PAYMENT_UPDATED",
    entityType: "Payment",
    entityId: payment.id,
    metadata: { status: "SUCCESS", reference: input.reference },
  });
  await writeAudit({
    actorId: payment.userId,
    action: "CASE_STATUS_CHANGED",
    entityType: "VerificationCase",
    entityId: payment.caseId,
    metadata: { from: payment.case.status, to: "PAID" },
  });

  return { ok: true as const, caseId: payment.caseId, already: false };
}
