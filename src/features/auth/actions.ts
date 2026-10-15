"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { prisma } from "@/server/db";
import { signIn } from "@/server/auth";
import { createChallenge, deliverOtp, peekChallenge, ticketDestination, verifyChallenge } from "@/server/auth/otp";
import { homeForRoles } from "@/server/auth/rbac";
import { requestMeta } from "@/server/request-meta";
import { rateLimit } from "@/lib/rate-limit";
import { isNigerianPhone, normalizePhone } from "@/lib/phone";
import { policyVersion } from "@/lib/utils";
import { loginCodeSchema, loginRequestSchema, registerSchema, verifySchema } from "@/features/auth/schema";
import type { RoleKey } from "@prisma/client";

function formError(error: unknown) {
  if (error instanceof Error && error.name === "ZodError") {
    return { error: "Check the form and try again" };
  }
  if (isRedirectError(error)) throw error;
  if (error instanceof AuthError) return { error: "That code is not valid, or it has expired" };
  if (error instanceof Error) return { error: error.message };
  return { error: "Something went wrong" };
}

export async function registerAction(input: unknown) {
  try {
    const data = registerSchema.parse(input);
    const meta = await requestMeta();
    const limit = rateLimit(`register:${meta.ipAddress ?? "local"}`, 8, 60 * 60 * 1000);
    if (!limit.ok) return { error: "Too many accounts from this network. Try again later." };

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { phone: data.phone }] },
    });
    if (existing) return { error: "An account already uses that email or phone number" };

    const role = await prisma.role.findUnique({ where: { key: "CUSTOMER" } });
    if (!role) return { error: "The customer role is not configured yet" };

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        acceptedTermsVersion: policyVersion(),
        acceptedTermsAt: new Date(),
        userRoles: { create: { roleId: role.id } },
        consents: {
          create: [
            { purpose: "ACCOUNT", policyVersion: policyVersion(), granted: true, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
            { purpose: "PRIVACY", policyVersion: policyVersion(), granted: true, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
          ],
        },
      },
    });

    const emailCode = await createChallenge({ userId: user.id, channel: "EMAIL", destination: data.email });
    const phoneCode = await createChallenge({ userId: user.id, channel: "SMS", destination: data.phone });
    await deliverOtp({ channel: "EMAIL", destination: data.email, code: emailCode, name: data.name });
    await deliverOtp({ channel: "SMS", destination: data.phone, code: phoneCode, name: data.name });
    return { ok: true as const, email: data.email, phone: data.phone };
  } catch (error) {
    return formError(error);
  }
}

export async function verifyRegistrationAction(input: unknown) {
  try {
    const data = verifySchema.parse(input);
    const user = await prisma.user.findFirst({
      where: { email: data.email, phone: data.phone },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) return { error: "We could not find that signup" };

    const emailOk = await peekChallenge(data.email, data.emailCode);
    const phoneOk = await peekChallenge(data.phone, data.phoneCode);
    if (!emailOk || !phoneOk) return { error: "One of those codes is wrong or has expired" };

    await verifyChallenge(data.email, data.emailCode);
    await verifyChallenge(data.phone, data.phoneCode);
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date(), phoneVerified: new Date() },
    });

    const roles = user.userRoles.map((row) => row.role.key) as RoleKey[];
    const ticket = await createChallenge({
      userId: user.id,
      channel: "EMAIL",
      destination: ticketDestination(user.id),
      ttlMs: 60_000,
    });
    await signIn("credentials", {
      destination: ticketDestination(user.id),
      code: ticket,
      redirectTo: homeForRoles(roles),
    });
    return { ok: true as const };
  } catch (error) {
    return formError(error);
  }
}

function destinationChannel(raw: string) {
  if (raw.includes("@")) return { channel: "EMAIL" as const, destination: raw.trim().toLowerCase() };
  const phone = normalizePhone(raw);
  if (!isNigerianPhone(phone)) return null;
  return { channel: "SMS" as const, destination: phone };
}

export async function requestLoginCodeAction(input: unknown) {
  try {
    const data = loginRequestSchema.parse(input);
    const parsed = destinationChannel(data.destination);
    if (!parsed) return { error: "Enter a valid email or Nigerian phone number" };
    const meta = await requestMeta();
    const limit = rateLimit(`otp:${parsed.destination}:${meta.ipAddress ?? "local"}`, 5, 15 * 60 * 1000);
    if (!limit.ok) return { error: "Too many codes. Wait a few minutes and try again." };

    const user = await prisma.user.findFirst({
      where: parsed.channel === "EMAIL" ? { email: parsed.destination } : { phone: parsed.destination },
    });
    if (!user || user.anonymizedAt) return { error: "No account uses that email or phone number" };
    if (!user.emailVerified && !user.phoneVerified) {
      return { error: "Finish verifying that account before you sign in", pending: true as const, email: user.email, phone: user.phone };
    }

    const code = await createChallenge({ userId: user.id, channel: parsed.channel, destination: parsed.destination });
    await deliverOtp({ channel: parsed.channel, destination: parsed.destination, code, name: user.name });
    return { ok: true as const, destination: parsed.destination };
  } catch (error) {
    return formError(error);
  }
}

export async function loginWithCodeAction(input: unknown) {
  try {
    const data = loginCodeSchema.parse(input);
    const parsed = destinationChannel(data.destination);
    if (!parsed) return { error: "Enter a valid email or Nigerian phone number" };
    const user = await prisma.user.findFirst({
      where: parsed.channel === "EMAIL" ? { email: parsed.destination } : { phone: parsed.destination },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) return { error: "That code is not valid, or it has expired" };
    const roles = user.userRoles.map((row) => row.role.key);
    await signIn("credentials", {
      destination: parsed.destination,
      code: data.code,
      redirectTo: homeForRoles(roles),
    });
    return { ok: true as const };
  } catch (error) {
    return formError(error);
  }
}

export async function signOutAction() {
  const { signOut } = await import("@/server/auth");
  await signOut({ redirectTo: "/" });
}
