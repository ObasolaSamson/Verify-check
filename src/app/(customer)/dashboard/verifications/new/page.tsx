import { redirect } from "next/navigation";
import type { TitleDocumentType } from "@prisma/client";
import { requireRole } from "@/server/auth/rbac";
import { CaseError, getOwnedCase, loadWizardOptions } from "@/server/cases/requests";
import { VerificationWizard, type WizardCase, type WizardState } from "@/features/verification/wizard";

export const metadata = { title: "New verification" };

export default async function NewVerificationPage({ searchParams }: { searchParams: Promise<{ caseId?: string }> }) {
  const user = await requireRole("CUSTOMER");
  const { caseId } = await searchParams;
  const states = await loadWizardOptions();

  const options: WizardState[] = states.map((state) => ({
    id: state.id,
    name: state.name,
    code: state.code,
    lgas: state.lgas.map((lga) => ({ id: lga.id, name: lga.name })),
    documentTypes: state.documentTypes.map((row) => row.documentType as TitleDocumentType),
    tiers: state.tierFees.map((fee) => ({
      id: fee.tierId,
      name: fee.tier.name,
      description: fee.tier.description,
      priceKobo: fee.priceKobo,
      turnaroundMinDays: fee.turnaroundMinDays,
      turnaroundMaxDays: fee.turnaroundMaxDays,
      checks: fee.tier.checks.map((check) => ({ title: check.title, description: check.description })),
    })),
  }));

  let initial: WizardCase | null = null;
  if (caseId) {
    try {
      const row = await getOwnedCase(user.id, caseId);
      if (row.submittedAt) redirect(`/dashboard/verifications/${row.id}`);
      initial = {
        id: row.id,
        code: row.code,
        wizardStep: row.wizardStep,
        tierId: row.tierId,
        priceKobo: row.priceKobo,
        property: {
          name: row.property.name ?? "",
          description: row.property.description ?? "",
          addressLine: row.property.addressLine,
          stateId: row.property.stateId,
          lgaId: row.property.lgaId,
          estateName: row.property.estateName ?? "",
          landmark: row.property.landmark ?? "",
          latitude: row.property.latitude ? Number(row.property.latitude) : null,
          longitude: row.property.longitude ? Number(row.property.longitude) : null,
        },
        contactName: row.contactName,
        contactPhone: row.contactPhone,
        contactEmail: row.contactEmail,
        contactRelationship: row.contactRelationship,
        contactRelationshipOther: row.contactRelationshipOther ?? "",
        documents: row.documents.map((document) => ({
          id: document.id,
          documentType: document.documentType,
          otherTypeLabel: document.otherTypeLabel ?? "",
          isGlobalCofO: document.isGlobalCofO,
          registrationNumber: document.registrationNumber ?? "",
          volume: document.volume ?? "",
          page: document.page ?? "",
          fileNumber: document.fileNumber ?? "",
          issuedOn: document.issuedOn ? document.issuedOn.toISOString().slice(0, 10) : "",
          nameOnDocument: document.nameOnDocument ?? "",
          files: document.files
            .filter((file) => !file.supersededAt)
            .map((file) => ({ id: file.fileId, name: file.file.originalName, mimeType: file.file.mimeType })),
        })),
      };
    } catch (error) {
      if (error instanceof CaseError) redirect("/dashboard/verifications/new");
      throw error;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-serif text-4xl">New verification</h1>
      {options.length === 0 ? (
        <p>No state is taking requests yet.</p>
      ) : (
        <VerificationWizard key={initial?.id ?? "new"} states={options} initial={initial} />
      )}
    </div>
  );
}
