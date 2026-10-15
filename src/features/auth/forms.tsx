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
import { registerSchema } from "@/features/auth/schema";
import {
  loginWithCodeAction,
  registerAction,
  requestLoginCodeAction,
  verifyRegistrationAction,
} from "@/features/auth/actions";

function Notice({ message }: { message: string }) {
  if (!message) return null;
  return <p className="rounded-md bg-[#f8e6e3] px-3 py-2 text-sm text-risk">{message}</p>;
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const form = useForm<z.input<typeof registerSchema>, unknown, z.output<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", phone: "", consent: false as unknown as true },
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
          const params = new URLSearchParams({ email: result.email, phone: result.phone });
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
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" type="tel" autoComplete="tel" placeholder="08012345678" {...form.register("phone")} />
        <p className="text-sm text-risk">{form.formState.errors.phone?.message}</p>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox
          checked={consent === true}
          onCheckedChange={(value) => form.setValue("consent", (value === true) as true, { shouldValidate: true })}
        />
        <span>
          I agree to the <Link className="font-semibold text-seal" href="/terms">terms</Link> and the{" "}
          <Link className="font-semibold text-seal" href="/privacy">privacy policy</Link>, including how TitleCheck processes my data under the Nigeria Data Protection Act 2023.
        </span>
      </label>
      <p className="text-sm text-risk">{form.formState.errors.consent?.message}</p>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        Create free account
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
  const [phone, setPhone] = useState(params.get("phone") ?? "");
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const result = await verifyRegistrationAction({ email, phone, emailCode, phoneCode });
        setPending(false);
        if (result && "error" in result && result.error) setError(result.error);
      }}
    >
      <Notice message={error} />
      <p className="text-sm text-ink-2">We sent a 6-digit code to your email and another to your phone.</p>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="emailCode">Email code</Label>
        <Input id="emailCode" inputMode="numeric" maxLength={6} value={emailCode} onChange={(event) => setEmailCode(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phoneCode">SMS code</Label>
        <Input id="phoneCode" inputMode="numeric" maxLength={6} value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        Verify and continue
      </Button>
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
        if (!sent) {
          const result = await requestLoginCodeAction({ destination });
          setPending(false);
          if ("error" in result && result.error) return setError(result.error);
          setSent(true);
          return;
        }
        const result = await loginWithCodeAction({ destination, code });
        setPending(false);
        if (result && "error" in result && result.error) setError(result.error);
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
      <Button type="submit" className="w-full" disabled={pending}>
        {sent ? "Sign in" : "Send code"}
      </Button>
    </form>
  );
}
