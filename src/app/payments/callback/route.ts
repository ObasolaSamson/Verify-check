import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { settleVerifiedPayment, verifyPaystackTransaction } from "@/server/paystack";

/** Paystack redirects here. The query string is never trusted; the transaction is re-verified server-side. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref");
  const session = await auth();
  if (!reference || !session?.user?.id) return NextResponse.redirect(new URL("/dashboard", url));

  const payment = await prisma.payment.findUnique({ where: { paystackReference: reference } });
  if (!payment || payment.userId !== session.user.id) return NextResponse.redirect(new URL("/dashboard", url));

  const verified = await verifyPaystackTransaction(reference).catch(() => null);
  if (verified) {
    await settleVerifiedPayment({
      reference,
      amountKobo: verified.amount,
      currency: verified.currency,
      status: verified.status,
      channel: verified.channel,
    });
  }
  return NextResponse.redirect(new URL(`/dashboard/verifications/${payment.caseId}`, url));
}
