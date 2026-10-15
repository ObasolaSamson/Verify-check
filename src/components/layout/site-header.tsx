import Link from "next/link";
import { auth } from "@/server/auth";
import { homeForRoles } from "@/server/auth/rbac";
import type { RoleKey } from "@prisma/client";

export async function SiteHeader() {
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as RoleKey[];
  const home = session?.user ? homeForRoles(roles) : "/login";

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="font-serif text-xl tracking-tight text-seal-dark">
          TitleCheck
        </Link>
        <nav className="flex items-center gap-4 text-sm font-semibold">
          <Link href="/pricing" className="text-ink-2 hover:text-ink">
            Pricing
          </Link>
          <Link href="/faq" className="hidden text-ink-2 hover:text-ink sm:inline">
            FAQ
          </Link>
          {session?.user ? (
            <Link href={home} className="rounded-md bg-seal px-3 py-2 text-paper">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-ink-2 hover:text-ink">
                Sign in
              </Link>
              <Link href="/register" className="rounded-md bg-seal px-3 py-2 text-paper">
                Create a free account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between">
        <p>Creating an account is free. You pay only when you start a title verification.</p>
        <div className="flex gap-4 font-semibold">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/faq">FAQ</Link>
        </div>
      </div>
    </footer>
  );
}
