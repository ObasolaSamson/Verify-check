import Link from "next/link";
import { signOutAction } from "@/features/auth/actions";

export function AppShell({
  title,
  user,
  links,
  children,
}: {
  title: string;
  user: { name: string | null; email: string | null };
  links: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-serif text-xl text-seal-dark">TitleCheck</Link>
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">{title}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-ink-2 sm:inline">{user.name ?? user.email}</span>
            <form action={signOutAction}>
              <button type="submit" className="font-semibold text-seal">Sign out</button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-4 overflow-x-auto px-4 pb-3 text-sm font-semibold">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap text-ink-2 hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
