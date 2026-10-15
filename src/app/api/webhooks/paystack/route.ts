import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { paystackConfigured, settleVerifiedPayment, verifyPaystackSignature, verifyPaystackTransaction } from "@/server/paystack";

type ChargeEvent = {
  event: string;
  data?: { id?: number; reference?: string; status?: string; amount?: number; currency?: string; channel?: string };
};

export async function POST(request: Request) {
  if (!paystackConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const raw = await request.text();
  if (!verifyPaystackSignature(raw, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  const event = JSON.parse(raw) as ChargeEvent;
  const reference = event.data?.reference ?? null;
  const eventKey = `${event.event}:${event.data?.id ?? createHash("sha256").update(raw).digest("hex")}`;

  try {
    await prisma.paystackEvent.create({
      data: { eventKey, eventType: event.event, reference, payload: event as Prisma.InputJsonValue },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw error;
  }

  if (event.event === "charge.success" && reference) {
    const verified = await verifyPaystackTransaction(reference);
    if (verified) {
      await settleVerifiedPayment({
        reference,
        amountKobo: verified.amount,
        currency: verified.currency,
        status: verified.status,
        channel: verified.channel,
      });
    }
  }

  await prisma.paystackEvent.update({ where: { eventKey }, data: { processedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
