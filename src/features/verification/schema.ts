import { z } from "zod";
import { isNigerianPhone, normalizePhone } from "@/lib/phone";

export const titleDocumentTypes = [
  "CERTIFICATE_OF_OCCUPANCY",
  "GOVERNORS_CONSENT",
  "DEED_OF_ASSIGNMENT",
  "DEED_OF_GIFT",
  "DEED_OF_LEASE",
  "DEED_OF_MORTGAGE",
  "REGISTERED_CONVEYANCE",
  "GAZETTE",
  "SURVEY_PLAN",
  "LETTER_OF_ALLOCATION",
  "CUSTOMARY_RIGHT_OF_OCCUPANCY",
  "COURT_JUDGMENT",
  "POWER_OF_ATTORNEY",
  "OTHER",
] as const;

export const relationships = ["SELLER", "AGENT", "FAMILY_HEAD", "DEVELOPER", "LAWYER", "OTHER"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const propertySchema = z
  .object({
    caseId: z.string().optional(),
    name: optionalText(160),
    description: optionalText(2000),
    addressLine: z.string().trim().min(8, "Enter the full address").max(400),
    stateId: z.string().min(1, "Choose a state"),
    lgaId: z.string().min(1, "Choose a local government"),
    estateName: optionalText(160),
    landmark: optionalText(160),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), {
    message: "Set both latitude and longitude, or leave the map pin empty",
    path: ["latitude"],
  });

export const contactSchema = z
  .object({
    caseId: z.string().min(1),
    contactName: z.string().trim().min(2, "Enter the contact name").max(160),
    contactPhone: z.string().trim().transform(normalizePhone).refine(isNigerianPhone, "Enter a Nigerian phone number"),
    contactEmail: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
    contactRelationship: z.enum(relationships),
    contactRelationshipOther: optionalText(80),
  })
  .refine((value) => value.contactRelationship !== "OTHER" || value.contactRelationshipOther, {
    message: "Describe the relationship",
    path: ["contactRelationshipOther"],
  });

export const documentSchema = z
  .object({
    id: z.string().optional(),
    documentType: z.enum(titleDocumentTypes),
    otherTypeLabel: optionalText(120),
    isGlobalCofO: z.boolean().optional(),
    registrationNumber: optionalText(80),
    volume: optionalText(40),
    page: optionalText(40),
    fileNumber: optionalText(80),
    issuedOn: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined))
      .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "Use a valid date"),
    nameOnDocument: z.string().trim().min(2, "Enter the name on the document").max(200),
  })
  .refine((value) => value.documentType !== "OTHER" || value.otherTypeLabel, {
    message: "Name the document type",
    path: ["otherTypeLabel"],
  })
  .refine((value) => Boolean(value.registrationNumber || value.fileNumber || value.volume), {
    message: "Add a registration number, file number, or volume",
    path: ["registrationNumber"],
  });

export const documentsSchema = z.object({
  caseId: z.string().min(1),
  documents: z.array(documentSchema).min(1, "Add at least one document"),
});

export const tierSchema = z.object({
  caseId: z.string().min(1),
  tierId: z.string().min(1, "Choose a tier"),
});

export const submitSchema = z.object({
  caseId: z.string().min(1),
  consent: z.literal(true, { message: "Confirm that we may store these documents for the search" }),
});
