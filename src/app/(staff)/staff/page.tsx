import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/server/auth/rbac";

const STAFF = ["FIELD_OFFICER", "SURVEYOR", "LAWYER", "ADMIN"];

export default async function StaffHome() {
  const user = await requireUser();
  if (!user.roles.some((role) => STAFF.includes(role))) redirect("/login");
  return (
    <AppShell title="Staff" user={user} links={[{ href: "/staff", label: "My tasks" }]}>
      <h1 className="font-serif text-4xl">My tasks</h1>
      <p className="mt-2 text-ink-2">Task assignment and evidence upload arrive in Phase 2.</p>
    </AppShell>
  );
}
