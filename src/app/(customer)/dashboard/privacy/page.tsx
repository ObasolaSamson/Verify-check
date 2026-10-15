import { requireRole } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { DataRequestForm } from "@/features/cases/data-request-form";

export const metadata = { title: "Privacy" };

const date = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" });

export default async function PrivacyRequestsPage() {
  const user = await requireRole("CUSTOMER");
  const requests = await prisma.dataSubjectRequest.findMany({ where: { userId: user.id }, orderBy: { requestedAt: "desc" } });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Your data</h1>
        <p className="mt-1 text-ink-2">Under the Nigeria Data Protection Act 2023 you can ask for a copy of your data or ask us to delete it. Payment records may be kept for accounting.</p>
      </div>
      <DataRequestForm />
      {requests.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          {requests.map((request) => (
            <li key={request.id} className="flex justify-between p-3">
              <span>{request.type === "EXPORT" ? "Data copy" : "Deletion"} · {date.format(request.requestedAt)}</span>
              <span className="font-semibold">{request.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
