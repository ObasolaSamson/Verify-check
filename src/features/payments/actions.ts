"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireRole } from "@/server/auth/rbac";
import { getOwnedCase } from "@/server/cases/requests";
import { prisma } from "@/server/db";
import {
  devPaymentAllowed,
  initializePaystack,
  paystackConfigured,
  settleVerifiedPayment,
} from "@/server/paystack";
import { writeAudit } from "@/server/audit";

const idSchema = z.object({ caseId: z.string().min(1) });

export async function startPaymentAction(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const { caseId } = idSchema.parse({ caseId: formData.get("caseId") });
  const row = await getOwnedCase(user.id, caseId);
  if (!row.submittedAt) redirect(`/dashboard/verifications/new?caseId=${caseId}`);
  if (row.status !== "PENDING_PAYMENT") redirect(`/dashboard/verifications/${caseId}`);
  if (!user.email) redirect(`/dashboard/verifications/${caseId}?error=email`);
  if (!paystackConfigured()) redirect(`/dashboard/verifications/${caseId}?error=paystack`);

  const reference = `tc_${row.id}_${Date.now()}`;
  const payment = await prisma.payment.create({
    data: {
      caseId: row.id,
      userId: user.id,
      paystackReference: reference,
      amountKobo: row.priceKobo,
      currency: "NGN",
    },
  });

  try {
    const started = await initializePaystack({
      email: user.email,
      amountKobo: row.priceKobo,
      reference,
      caseId: row.id,
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { paystackAccessCode: started.access_code },
    });
    redirect(started.authorization_url);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", failureReason: error instanceof Error ? error.message : "Could not start Paystack" },
    });
    redirect(`/dashboard/verifications/${caseId}?error=payment`);
  }
}

export async function simulateDevPaymentAction(formData: FormData) {
  if (!devPaymentAllowed()) redirect("/dashboard");
  const user = await requireRole("CUSTOMER");
  const { caseId } = idSchema.parse({ caseId: formData.get("caseId") });
  const row = await getOwnedCase(user.id, caseId);
  if (!row.submittedAt || row.status !== "PENDING_PAYMENT") redirect(`/dashboard/verifications/${caseId}`);

  const reference = `dev_${row.id}_${Date.now()}`;
  await prisma.payment.create({
    data: {
      caseId: row.id,
      userId: user.id,
      paystackReference: reference,
      amountKobo: row.priceKobo,
      status: "PENDING",
    },
  });
  await settleVerifiedPayment({
    reference,
    amountKobo: row.priceKobo,
    currency: "NGN",
    status: "success",
    channel: "development",
  });
  await writeAudit({
    actorId: user.id,
    action: "PAYMENT_UPDATED",
    entityType: "Payment",
    entityId: reference,
    metadata: { development: true },
  });
  revalidatePath(`/dashboard/verifications/${caseId}`);
  redirect(`/dashboard/verifications/${caseId}?paid=1`);
}
