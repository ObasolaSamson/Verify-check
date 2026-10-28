"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { registerSchema } from "@/features/auth/schema";
import {
  loginWithCodeAction,
  registerAction,
  requestLoginCodeAction,
  resendRegistrationCodeAction,
  verifyRegistrationAction,
} from "@/features/auth/actions";

function Notice({ message }: { message: string }) {
  if (!message) return null;
  return <p className="rounded-md bg-[#f8e6e3] px-3 py-2 text-sm text-risk">{message}</p>;
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  // Stays true after a successful sign-up so the button keeps spinning until the verify page loads.
  const [redirecting, setRedirecting] = useState(false);
  const form = useForm<z.input<typeof registerSchema>, unknown, z.output<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", consent: false as unknown as true },
  });
  const consent = form.watch("consent");

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        setError("");
        const result = await registerAction(values);
        if ("error" in result && result.error) return setError(result.error);
        if ("ok" in result) {
          const params = new URLSearchParams({ email: values.email });
          if ("emailSent" in result && result.emailSent === false) params.set("sent", "0");
          setRedirecting(true);
          router.push(`/verify?${params}`);
        }
      })}
    >
      <Notice message={error} />
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" autoComplete="name" {...form.register("name")} />
        <p className="text-sm text-risk">{form.formState.errors.name?.message}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        <p className="text-sm text-risk">{form.formState.errors.email?.message}</p>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox
          checked={consent === true}
          onCheckedChange={(value) => form.setValue("consent", (value === true) as true, { shouldValidate: true })}
        />
        <span>
          I agree to the <Link className="font-semibold text-seal" href="/terms">terms</Link> and the{" "}
          <Link className="font-semibold text-seal" href="/privacy">privacy policy</Link>, including how VerifyTitle Nigeria processes my data under the Nigeria Data Protection Act 2023.
        </span>
      </label>
      <p className="text-sm text-risk">{form.formState.errors.consent?.message}</p>
      <Button type="submit" className="w-full" loading={form.formState.isSubmitting || redirecting}>
        {form.formState.isSubmitting || redirecting ? "Creating your account…" : "Create free account"}
      </Button>
      <p className="text-center text-sm text-ink-2">
        No payment now. You pay only when you submit a verification.
      </p>
    </form>
  );
}

export function VerifyForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [emailCode, setEmailCode] = useState("");
  const [error, setError] = useState(() => {
    if (params.get("sent") === "0") {
      return "Your account is created, but we could not send the email. Tap “Send a new code” below.";
    }
    if (params.get("link") === "expired") return "That confirmation link has expired. Tap “Send a new code” below for a fresh one.";
    if (params.get("link") === "invalid") return "That confirmation link is not valid. Enter your email below and tap “Send a new code”.";
    return "";
  });
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        setNotice("");
        try {
          const result = await verifyRegistrationAction({ email, emailCode });
          // On success the server redirects, so keep the spinner going until the next page appears.
          if (result && "error" in result && result.error) {
            setError(result.error);
            setPending(false);
          }
        } catch {
          setError("Something went wrong. Check your connection and try again.");
          setPending(false);
        }
      }}
    >
      <Notice message={error} />
      {notice ? <p className="rounded-md bg-brass-wash px-3 py-2 text-sm text-ink-2">{notice}</p> : null}
      <p className="text-sm text-ink-2">
        Check your email. Click the confirmation link (it works for 24 hours), or enter the 6-digit code from the same email (it works for 10 minutes).
      </p>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="emailCode">Email code</Label>
        <Input id="emailCode" inputMode="numeric" maxLength={6} value={emailCode} onChange={(event) => setEmailCode(event.target.value)} />
      </div>
      <Button type="submit" className="w-full" loading={pending} disabled={resending}>
        {pending ? "Verifying…" : "Verify and continue"}
      </Button>
      <button
        type="button"
        className="inline-flex w-full items-center justify-center gap-2 text-center text-sm font-semibold text-seal disabled:opacity-60"
        disabled={pending || resending || !email}
        aria-busy={resending || undefined}
        onClick={async () => {
          setError("");
          setNotice("");
          setResending(true);
          try {
            const result = await resendRegistrationCodeAction({ email });
            if ("error" in result && result.error) return setError(result.error);
            setNotice("If that email is waiting for confirmation, we sent a new code.");
          } catch {
            setError("Something went wrong. Check your connection and try again.");
          } finally {
            setResending(false);
          }
        }}
      >
        {resending ? <Spinner /> : null}
        {resending ? "Sending…" : "Send a new code"}
      </button>
    </form>
  );
}

export function LoginForm() {
  const [destination, setDestination] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          if (!sent) {
            const result = await requestLoginCodeAction({ destination });
            setPending(false);
            if ("error" in result && result.error) return setError(result.error);
            setSent(true);
            return;
          }
          const result = await loginWithCodeAction({ destination, code });
          // On success the server redirects, so keep the spinner going until the next page appears.
          if (result && "error" in result && result.error) {
            setError(result.error);
            setPending(false);
          }
        } catch {
          setError("Something went wrong. Check your connection and try again.");
          setPending(false);
        }
      }}
    >
      <Notice message={error} />
      <div className="space-y-2">
        <Label htmlFor="destination">Email or phone</Label>
        <Input
          id="destination"
          autoComplete="username"
          value={destination}
          disabled={sent}
          onChange={(event) => setDestination(event.target.value)}
        />
      </div>
      {sent ? (
        <div className="space-y-2">
          <Label htmlFor="code">6-digit code</Label>
          <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} />
          <button type="button" className="text-sm font-semibold text-seal" onClick={() => { setSent(false); setCode(""); }}>
            Use a different email or phone
          </button>
        </div>
      ) : null}
      <Button type="submit" className="w-full" loading={pending}>
        {sent ? (pending ? "Signing in…" : "Sign in") : pending ? "Sending code…" : "Send code"}
      </Button>
    </form>
  );
}
