import type { CaseStatus, CheckType, ContactRelationship, TitleDocumentType } from "@prisma/client";

export const DOCUMENT_LABELS: Record<TitleDocumentType, string> = {
  CERTIFICATE_OF_OCCUPANCY: "Certificate of Occupancy (C of O)",
  GOVERNORS_CONSENT: "Governor's Consent",
  DEED_OF_ASSIGNMENT: "Deed of Assignment",
  DEED_OF_GIFT: "Deed of Gift",
  DEED_OF_LEASE: "Deed of Lease",
  DEED_OF_MORTGAGE: "Deed of Mortgage",
  REGISTERED_CONVEYANCE: "Registered Conveyance",
  GAZETTE: "Gazette (excision / ratification)",
  SURVEY_PLAN: "Survey Plan",
  LETTER_OF_ALLOCATION: "Letter of Allocation",
  CUSTOMARY_RIGHT_OF_OCCUPANCY: "Customary Right of Occupancy",
  COURT_JUDGMENT: "Court Judgment",
  POWER_OF_ATTORNEY: "Power of Attorney",
  OTHER: "Other",
};

export const RELATIONSHIP_LABELS: Record<ContactRelationship, string> = {
  SELLER: "Seller",
  AGENT: "Agent",
  FAMILY_HEAD: "Family head",
  DEVELOPER: "Developer",
  LAWYER: "Lawyer",
  OTHER: "Other",
};

export const CHECK_LABELS: Record<CheckType, string> = {
  REGISTRY_SEARCH: "Land Registry search",
  SURVEY_CHARTING: "Survey plan charting",
  GAZETTE_CHECK: "Gazette / excision check",
  SITE_VISIT: "Site visit",
  AGENT_CHECK: "Agent check",
  ENCUMBRANCE_SEARCH: "Encumbrance search",
  LITIGATION_SEARCH: "Litigation search",
  COMMUNITY_CHECK: "Family and community check",
  LEGAL_REVIEW: "Legal review",
};

export const STATUS_LABELS: Record<CaseStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  UNDER_REVIEW: "With the lawyer",
  COMPLETED: "Completed",
  ON_HOLD: "On hold",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export function caseStatusLabel(status: CaseStatus, submittedAt: Date | null) {
  if (status === "PENDING_PAYMENT" && !submittedAt) return "Draft";
  return STATUS_LABELS[status];
}
