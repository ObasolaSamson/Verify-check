import { AppShell } from "@/components/layout/app-shell";
import { requireRole } from "@/server/auth/rbac";

export default async function AgentHome() {
  const user = await requireRole("AGENT");
  return (
    <AppShell title="Agent" user={user} links={[{ href: "/agent", label: "Overview" }]}>
      <h1 className="font-serif text-4xl">Agent dashboard</h1>
      <p className="mt-2 text-ink-2">Profiles, licensing, and KYC arrive in Phase 4.</p>
    </AppShell>
  );
}
