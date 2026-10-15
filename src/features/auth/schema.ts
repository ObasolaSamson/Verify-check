import { z } from "zod";
import { isNigerianPhone, normalizePhone } from "@/lib/phone";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  phone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .refine(isNigerianPhone, "Enter a Nigerian phone number, for example 08012345678"),
  consent: z.literal(true, { message: "Agree to the terms and privacy policy to create an account" }),
});

export const loginRequestSchema = z.object({
  destination: z.string().trim().min(3, "Enter your email or phone number").max(200),
});

export const loginCodeSchema = z.object({
  destination: z.string().trim().min(3).max(200),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const verifySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().transform(normalizePhone).refine(isNigerianPhone),
  emailCode: z.string().trim().regex(/^\d{6}$/, "Enter the email code"),
  phoneCode: z.string().trim().regex(/^\d{6}$/, "Enter the SMS code"),
});
