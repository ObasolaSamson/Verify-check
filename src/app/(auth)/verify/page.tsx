import { Suspense } from "react";
import { VerifyForm } from "@/features/auth/forms";

export const metadata = { title: "Confirm your account" };

export default function VerifyPage() {
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl">Confirm your email</h1>
      <Suspense>
        <VerifyForm />
      </Suspense>
    </div>
  );
}
