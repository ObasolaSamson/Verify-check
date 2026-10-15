import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 font-serif text-2xl text-seal-dark">
        TitleCheck
      </Link>
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6">{children}</div>
    </div>
  );
}
