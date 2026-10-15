"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  contactSchema,
  documentsSchema,
  propertySchema,
  submitSchema,
  tierSchema,
} from "@/features/verification/schema";
import { requireRole } from "@/server/auth/rbac";
import {
  CaseError,
  saveContactStep,
  saveDocumentsStep,
  savePropertyStep,
  saveTierStep,
  submitCase,
} from "@/server/cases/requests";

function failure(error: unknown) {
  if (isRedirectError(error)) throw error;
  if (error instanceof CaseError) return { error: error.message };
  if (error instanceof Error && error.name === "ZodError") return { error: "Check the form and try again" };
  console.error(error);
  return { error: "We could not save that step" };
}

export async function savePropertyAction(input: unknown) {
  try {
    const user = await requireRole("CUSTOMER");
    const data = propertySchema.parse(input);
    const caseId = await savePropertyStep(user.id, data);
    revalidatePath("/dashboard/verifications");
    return { ok: true as const, caseId };
  } catch (error) {
    return failure(error);
  }
}

export async function saveContactAction(input: unknown) {
  try {
    const user = await requireRole("CUSTOMER");
    const data = contactSchema.parse(input);
    await saveContactStep(user.id, data);
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function saveDocumentsAction(input: unknown) {
  try {
    const user = await requireRole("CUSTOMER");
    const data = documentsSchema.parse(input);
    const documents = await saveDocumentsStep(user.id, data.caseId, data.documents);
    return {
      ok: true as const,
      documents: documents.map((document) => ({
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
          .map((file) => ({
            id: file.fileId,
            name: file.file.originalName,
            mimeType: file.file.mimeType,
          })),
      })),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function saveTierAction(input: unknown) {
  try {
    const user = await requireRole("CUSTOMER");
    const data = tierSchema.parse(input);
    await saveTierStep(user.id, data.caseId, data.tierId);
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function submitCaseAction(input: unknown) {
  try {
    const user = await requireRole("CUSTOMER");
    const data = submitSchema.parse(input);
    const caseId = await submitCase(user.id, data.caseId, data.consent);
    revalidatePath("/dashboard");
    return { ok: true as const, caseId };
  } catch (error) {
    return failure(error);
  }
}
