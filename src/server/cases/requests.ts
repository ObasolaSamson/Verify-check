import type { ContactRelationship, Prisma, TitleDocumentType } from "@prisma/client";
import { allocateCaseCode } from "@/server/cases/case-code";
import { prisma } from "@/server/db";
import { writeAudit } from "@/server/audit";

export class CaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaseError";
  }
}

const caseInclude = {
  property: { include: { state: true, lga: true } },
  tier: { include: { checks: { orderBy: { sortOrder: "asc" } } } },
  documents: { include: { files: { include: { file: true }, orderBy: { createdAt: "desc" } } } },
  events: { where: { customerVisible: true }, orderBy: { createdAt: "asc" } },
  payments: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.VerificationCaseInclude;

export async function getOwnedCase(customerId: string, caseId: string) {
  const row = await prisma.verificationCase.findFirst({
    where: { id: caseId, customerId },
    include: caseInclude,
  });
  if (!row) throw new CaseError("That verification could not be found");
  return row;
}

async function feeFor(stateId: string, tierId: string) {
  const fee = await prisma.stateTierFee.findUnique({
    where: { stateId_tierId: { stateId, tierId } },
    include: { tier: true, state: true },
  });
  if (!fee || !fee.active || !fee.tier.active || !fee.state.active) {
    throw new CaseError("That tier is not offered in this state");
  }
  return fee;
}

async function assertLga(stateId: string, lgaId: string) {
  const lga = await prisma.lga.findFirst({ where: { id: lgaId, stateId } });
  if (!lga) throw new CaseError("Choose a local government in the selected state");
  return lga;
}

export async function savePropertyStep(
  customerId: string,
  input: {
    caseId?: string;
    name?: string;
    description?: string;
    addressLine: string;
    stateId: string;
    lgaId: string;
    estateName?: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
  },
) {
  await assertLga(input.stateId, input.lgaId);
  const state = await prisma.state.findUnique({ where: { id: input.stateId } });
  if (!state?.active) throw new CaseError("VerifyTitle Nigeria is not taking requests in that state yet");

  const propertyData = {
    name: input.name || null,
    description: input.description || null,
    addressLine: input.addressLine,
    stateId: input.stateId,
    lgaId: input.lgaId,
    estateName: input.estateName || null,
    landmark: input.landmark || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  };

  if (input.caseId) {
    const existing = await getOwnedCase(customerId, input.caseId);
    if (existing.submittedAt) throw new CaseError("This request has already been submitted");
    await prisma.property.update({ where: { id: existing.propertyId }, data: propertyData });
    const fee = await feeFor(input.stateId, existing.tierId);
    await prisma.verificationCase.update({
      where: { id: existing.id },
      data: {
        wizardStep: Math.max(existing.wizardStep, 2),
        priceKobo: fee.priceKobo,
        turnaroundMinDays: fee.turnaroundMinDays,
        turnaroundMaxDays: fee.turnaroundMaxDays,
      },
    });
    return existing.id;
  }

  const defaultTier = await prisma.tier.findFirst({
    where: { active: true, fees: { some: { stateId: input.stateId, active: true } } },
    orderBy: { sortOrder: "asc" },
  });
  if (!defaultTier) throw new CaseError("No verification tier is configured for this state");
  const fee = await feeFor(input.stateId, defaultTier.id);
  const code = await allocateCaseCode(state.code);
  const property = await prisma.property.create({ data: { ...propertyData, createdById: customerId } });

  const created = await prisma.verificationCase.create({
    data: {
      code,
      customerId,
      propertyId: property.id,
      tierId: defaultTier.id,
      priceKobo: fee.priceKobo,
      turnaroundMinDays: fee.turnaroundMinDays,
      turnaroundMaxDays: fee.turnaroundMaxDays,
      wizardStep: 2,
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      contactRelationship: "SELLER",
    },
  });
  return created.id;
}

export async function saveContactStep(
  customerId: string,
  input: {
    caseId: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    contactRelationship: ContactRelationship;
    contactRelationshipOther?: string;
  },
) {
  const existing = await getOwnedCase(customerId, input.caseId);
  if (existing.submittedAt) throw new CaseError("This request has already been submitted");
  await prisma.verificationCase.update({
    where: { id: existing.id },
    data: {
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      contactRelationship: input.contactRelationship,
      contactRelationshipOther: input.contactRelationship === "OTHER" ? input.contactRelationshipOther || null : null,
      wizardStep: Math.max(existing.wizardStep, 3),
    },
  });
}

export type DocumentInput = {
  id?: string;
  documentType: TitleDocumentType;
  otherTypeLabel?: string;
  isGlobalCofO?: boolean;
  registrationNumber?: string;
  volume?: string;
  page?: string;
  fileNumber?: string;
  issuedOn?: string;
  nameOnDocument: string;
};

export async function saveDocumentsStep(customerId: string, caseId: string, documents: DocumentInput[]) {
  const existing = await getOwnedCase(customerId, caseId);
  if (existing.submittedAt) throw new CaseError("This request has already been submitted");
  if (documents.length === 0) throw new CaseError("Add at least one title document");

  const allowed = await prisma.stateDocumentType.findMany({
    where: { stateId: existing.property.stateId, active: true },
  });
  const allowedTypes = new Set(allowed.map((row) => row.documentType));
  for (const document of documents) {
    if (!allowedTypes.has(document.documentType)) {
      throw new CaseError("That document type is not used for this state");
    }
  }

  const keep = new Set(documents.map((document) => document.id).filter(Boolean) as string[]);
  const removable = existing.documents.filter((document) => !keep.has(document.id));
  if (removable.length) {
    await prisma.titleDocumentFile.deleteMany({ where: { titleDocumentId: { in: removable.map((document) => document.id) } } });
    await prisma.titleDocument.deleteMany({ where: { id: { in: removable.map((document) => document.id) } } });
  }

  for (const document of documents) {
    const data = {
      documentType: document.documentType,
      otherTypeLabel: document.documentType === "OTHER" ? document.otherTypeLabel || null : null,
      isGlobalCofO: document.documentType === "CERTIFICATE_OF_OCCUPANCY" ? Boolean(document.isGlobalCofO) : false,
      registrationNumber: document.registrationNumber || null,
      volume: document.volume || null,
      page: document.page || null,
      fileNumber: document.fileNumber || null,
      issuedOn: document.issuedOn ? new Date(document.issuedOn) : null,
      nameOnDocument: document.nameOnDocument,
    };
    if (document.id && existing.documents.some((row) => row.id === document.id)) {
      await prisma.titleDocument.update({ where: { id: document.id }, data });
    } else {
      await prisma.titleDocument.create({ data: { ...data, caseId } });
    }
  }

  await prisma.verificationCase.update({
    where: { id: caseId },
    data: { wizardStep: Math.max(existing.wizardStep, 4) },
  });

  return prisma.titleDocument.findMany({
    where: { caseId },
    include: { files: { include: { file: true }, orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function saveTierStep(customerId: string, caseId: string, tierId: string) {
  const existing = await getOwnedCase(customerId, caseId);
  if (existing.submittedAt) throw new CaseError("This request has already been submitted");
  const fee = await feeFor(existing.property.stateId, tierId);
  await prisma.verificationCase.update({
    where: { id: caseId },
    data: {
      tierId,
      priceKobo: fee.priceKobo,
      turnaroundMinDays: fee.turnaroundMinDays,
      turnaroundMaxDays: fee.turnaroundMaxDays,
      wizardStep: Math.max(existing.wizardStep, 5),
    },
  });
}

export async function submitCase(customerId: string, caseId: string, consent: boolean) {
  if (!consent) throw new CaseError("Consent is required before we can hold these documents");
  const existing = await getOwnedCase(customerId, caseId);
  if (existing.submittedAt) return existing.id;
  if (!existing.contactName || !existing.contactPhone || !existing.contactEmail) {
    throw new CaseError("Add the person we should call about the documents");
  }
  if (existing.documents.length === 0) throw new CaseError("Add at least one title document");
  const hasFile = existing.documents.some((document) => document.files.some((file) => !file.supersededAt));
  if (!hasFile) throw new CaseError("Upload at least one scan or photo of the title");

  const fee = await feeFor(existing.property.stateId, existing.tierId);
  await prisma.verificationCase.update({
    where: { id: caseId },
    data: {
      submittedAt: new Date(),
      consentGrantedAt: new Date(),
      wizardStep: 6,
      priceKobo: fee.priceKobo,
      turnaroundMinDays: fee.turnaroundMinDays,
      turnaroundMaxDays: fee.turnaroundMaxDays,
      status: "PENDING_PAYMENT",
    },
  });
  await prisma.consentRecord.create({
    data: {
      userId: customerId,
      purpose: "TITLE_VERIFICATION",
      policyVersion: process.env.POLICY_VERSION || "2026-10-14",
      granted: true,
    },
  });
  await prisma.caseEvent.create({
    data: {
      caseId,
      actorId: customerId,
      status: "PENDING_PAYMENT",
      title: "Request submitted",
      detail: "The case is saved. Payment is separate, and the search starts after it clears.",
      customerVisible: true,
    },
  });
  await writeAudit({
    actorId: customerId,
    action: "CASE_STATUS_CHANGED",
    entityType: "VerificationCase",
    entityId: caseId,
    metadata: { event: "submitted" },
  });
  return caseId;
}

export async function listCustomerCases(customerId: string) {
  return prisma.verificationCase.findMany({
    where: { customerId },
    include: { property: { include: { lga: true, state: true } }, tier: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function loadWizardOptions() {
  const states = await prisma.state.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      lgas: { orderBy: { name: "asc" } },
      documentTypes: { where: { active: true } },
      tierFees: {
        where: { active: true, tier: { active: true } },
        include: { tier: { include: { checks: { orderBy: { sortOrder: "asc" } } } } },
        orderBy: { tier: { sortOrder: "asc" } },
      },
    },
  });
  return states;
}
