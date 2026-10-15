import { AppShell } from "@/components/layout/app-shell";
import { requireRole } from "@/server/auth/rbac";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("CUSTOMER");
  return (
    <AppShell
      title="Customer"
      user={user}
      links={[
        { href: "/dashboard", label: "Overview" },
        { href: "/dashboard/verifications", label: "My verifications" },
        { href: "/dashboard/verifications/new", label: "New verification" },
        { href: "/dashboard/payments", label: "Payments" },
        { href: "/dashboard/reports", label: "Reports" },
        { href: "/dashboard/privacy", label: "Privacy" },
      ]}
    >
      {children}
    </AppShell>
  );
}
