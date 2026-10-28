import Link from "next/link";
import { LoginForm } from "@/features/auth/forms";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ confirmed?: string }> }) {
  const { confirmed } = await searchParams;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl">Sign in</h1>
        <p className="mt-1 text-sm text-ink-2">We send a one-time code. There is no password.</p>
      </div>
      {confirmed === "1" ? (
        <p role="status" className="rounded-md bg-seal-wash px-3 py-2 text-sm text-seal-dark">
          Your email is confirmed. Enter it below and we will send you a sign-in code.
        </p>
      ) : null}
      <LoginForm />
      {process.env.NODE_ENV === "development" && process.env.DEV_OTP_CODE ? (
        <p className="rounded-md bg-brass-wash px-3 py-2 text-xs text-ink-2">
          Development: seeded users such as customer@titlecheck.test accept code {process.env.DEV_OTP_CODE}.
        </p>
      ) : null}
      <p className="text-center text-sm">
        New here? <Link href="/register" className="font-semibold text-seal">Create a free account</Link>
      </p>
    </div>
  );
}
