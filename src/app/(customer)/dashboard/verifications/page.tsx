import { requireRole } from "@/server/auth/rbac";
import { listCustomerCases } from "@/server/cases/requests";
import { CaseList } from "@/features/cases/case-list";

export const metadata = { title: "My verifications" };

export default async function VerificationsPage() {
  const user = await requireRole("CUSTOMER");
  const cases = await listCustomerCases(user.id);
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">My verifications</h1>
      <CaseList cases={cases} />
    </div>
  );
}
