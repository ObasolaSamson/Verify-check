import Link from "next/link";
import { RegisterForm } from "@/features/auth/forms";

export const metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl">Create a free account</h1>
        <p className="mt-1 text-sm text-ink-2">We confirm your email and phone with a code. Nothing is charged.</p>
      </div>
      <RegisterForm />
      <p className="text-center text-sm">
        Already registered? <Link href="/login" className="font-semibold text-seal">Sign in</Link>
      </p>
    </div>
  );
}
