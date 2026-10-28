import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  consent: z.literal(true, { message: "Agree to the terms and privacy policy to create an account" }),
});

export const loginRequestSchema = z.object({
  destination: z.string().trim().min(3, "Enter your email or phone number").max(200),
});

export const loginCodeSchema = z.object({
  destination: z.string().trim().min(3).max(200),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const resendSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const verifySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  emailCode: z.string().trim().regex(/^\d{6}$/, "Enter the email code"),
});
