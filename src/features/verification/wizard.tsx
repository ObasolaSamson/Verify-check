"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { DOCUMENT_LABELS, RELATIONSHIP_LABELS } from "@/lib/labels";
import { formatNairaFromKobo, turnaroundLabel } from "@/lib/money";
import {
  contactSchema,
  documentsSchema,
  propertySchema,
  relationships,
  submitSchema,
  titleDocumentTypes,
} from "@/features/verification/schema";
import {
  saveContactAction,
  saveDocumentsAction,
  savePropertyAction,
  saveTierAction,
  submitCaseAction,
} from "@/features/verification/actions";

const LocationPicker = dynamic(
  () => import("@/components/map/location-picker").then((mod) => mod.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div role="status" className="flex h-72 items-center justify-center gap-2 rounded-md border border-line bg-paper text-sm text-ink-2">
        <Spinner className="text-seal" />
        Loading map…
      </div>
    ),
  },
);

const STEPS = ["Property", "Contact", "Documents", "Files", "Tier", "Review"];

type TitleType = (typeof titleDocumentTypes)[number];

export type WizardState = {
  id: string;
  name: string;
  code: string;
  lgas: { id: string; name: string }[];
  documentTypes: TitleType[];
  tiers: {
    id: string;
    name: string;
    description: string;
    priceKobo: number;
    turnaroundMinDays: number;
    turnaroundMaxDays: number;
    checks: { title: string; description: string }[];
  }[];
};

export type WizardCase = {
  id: string;
  code: string;
  wizardStep: number;
  tierId: string;
  priceKobo: number;
  property: {
    name: string;
    description: string;
    addressLine: string;
    stateId: string;
    lgaId: string;
    estateName: string;
    landmark: string;
    latitude: number | null;
    longitude: number | null;
  };
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactRelationship: (typeof relationships)[number];
  contactRelationshipOther: string;
  documents: DocDraft[];
};

type DocDraft = {
  id?: string;
  documentType: TitleType;
  otherTypeLabel: string;
  isGlobalCofO: boolean;
  registrationNumber: string;
  volume: string;
  page: string;
  fileNumber: string;
  issuedOn: string;
  nameOnDocument: string;
  files: { id: string; name: string; mimeType: string; previewPath?: string }[];
};

const emptyDoc = (): DocDraft => ({
  documentType: "CERTIFICATE_OF_OCCUPANCY",
  otherTypeLabel: "",
  isGlobalCofO: false,
  registrationNumber: "",
  volume: "",
  page: "",
  fileNumber: "",
  issuedOn: "",
  nameOnDocument: "",
  files: [],
});

export function VerificationWizard({ states, initial }: { states: WizardState[]; initial: WizardCase | null }) {
  const router = useRouter();
  const [step, setStep] = useState(initial ? Math.min(initial.wizardStep, 6) : 1);
  const [caseId, setCaseId] = useState(initial?.id ?? "");
  const caseCode = initial?.code ?? "";
  const [stateId, setStateId] = useState(initial?.property.stateId ?? states[0]?.id ?? "");
  const [tierId, setTierId] = useState(initial?.tierId ?? "");
  const [documents, setDocuments] = useState<DocDraft[]>(initial?.documents.length ? initial.documents : [emptyDoc()]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | undefined>(initial?.property.latitude ?? undefined);
  const [longitude, setLongitude] = useState<number | undefined>(initial?.property.longitude ?? undefined);

  const state = states.find((item) => item.id === stateId) ?? states[0];
  const selectedTier = state?.tiers.find((tier) => tier.id === tierId) ?? state?.tiers[0];

  const propertyForm = useForm<z.input<typeof propertySchema>, unknown, z.output<typeof propertySchema>>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      caseId: initial?.id,
      name: initial?.property.name ?? "",
      description: initial?.property.description ?? "",
      addressLine: initial?.property.addressLine ?? "",
      stateId,
      lgaId: initial?.property.lgaId ?? state?.lgas[0]?.id ?? "",
      estateName: initial?.property.estateName ?? "",
      landmark: initial?.property.landmark ?? "",
    },
  });

  const contactForm = useForm<z.input<typeof contactSchema>, unknown, z.output<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      caseId: initial?.id ?? "",
      contactName: initial?.contactName ?? "",
      contactPhone: initial?.contactPhone ?? "",
      contactEmail: initial?.contactEmail ?? "",
      contactRelationship: initial?.contactRelationship ?? "SELLER",
      contactRelationshipOther: initial?.contactRelationshipOther ?? "",
    },
  });

  const documentsForm = useForm<z.input<typeof documentsSchema>>({
    resolver: zodResolver(documentsSchema),
    defaultValues: { caseId: initial?.id ?? "", documents: documents.map(stripFiles) },
  });
  const documentFields = useFieldArray({ control: documentsForm.control, name: "documents" });
  const relationship = contactForm.watch("contactRelationship");

  const summary = useMemo(() => documents, [documents]);

  async function run<T extends object>(task: () => Promise<T | { error: string }>): Promise<T | null> {
    setPending(true);
    setError("");
    try {
      const result = await task();
      if ("error" in result && typeof result.error === "string") {
        setError(result.error);
        return null;
      }
      return result as T;
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <ol className="grid grid-cols-3 gap-2 text-xs font-semibold sm:grid-cols-6">
        {STEPS.map((label, index) => (
          <li key={label} className={index + 1 === step ? "text-seal" : "text-ink-3"}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      {caseCode ? <p className="text-sm text-ink-2">Reference {caseCode}. You can leave and come back before you submit.</p> : null}
      {error ? <p className="rounded-md bg-[#f8e6e3] px-3 py-2 text-sm text-risk">{error}</p> : null}

      {step === 1 ? (
        <form
          className="space-y-4"
          onSubmit={propertyForm.handleSubmit(async (values) => {
            const result = await run(() =>
              savePropertyAction({
                ...values,
                caseId: caseId || undefined,
                latitude,
                longitude,
              }),
            );
            if (!result || !("caseId" in result) || !result.caseId) return;
            setCaseId(result.caseId);
            contactForm.setValue("caseId", result.caseId);
            documentsForm.setValue("caseId", result.caseId);
            setStep(2);
            router.replace(`/dashboard/verifications/new?caseId=${result.caseId}`);
          })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="addressLine">Full address</Label>
              <Input id="addressLine" {...propertyForm.register("addressLine")} />
              <FieldError message={propertyForm.formState.errors.addressLine?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Property name</Label>
              <Input id="name" {...propertyForm.register("name")} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estateName">Estate</Label>
              <Input id="estateName" {...propertyForm.register("estateName")} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stateId">State</Label>
              <select
                id="stateId"
                className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
                {...propertyForm.register("stateId", {
                  onChange: (event) => {
                    const next = event.target.value;
                    setStateId(next);
                    const match = states.find((item) => item.id === next);
                    propertyForm.setValue("lgaId", match?.lgas[0]?.id ?? "");
                    setTierId("");
                  },
                })}
              >
                {states.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lgaId">Local government</Label>
              <select id="lgaId" className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm" {...propertyForm.register("lgaId")}>
                {state?.lgas.map((lga) => (
                  <option key={lga.id} value={lga.id}>
                    {lga.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="landmark">Landmark</Label>
              <Input id="landmark" {...propertyForm.register("landmark")} placeholder="Optional" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...propertyForm.register("description")} placeholder="Optional" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Map pin</Label>
            <p className="text-sm text-ink-2">Optional. Click the map to drop a pin. This is the location later site photos are compared with.</p>
            <LocationPicker
              latitude={latitude}
              longitude={longitude}
              onChange={(lat, lng) => {
                setLatitude(Number(lat.toFixed(6)));
                setLongitude(Number(lng.toFixed(6)));
              }}
            />
            {latitude !== undefined ? (
              <button
                type="button"
                className="text-sm font-semibold text-seal"
                onClick={() => {
                  setLatitude(undefined);
                  setLongitude(undefined);
                }}
              >
                Clear pin ({latitude}, {longitude})
              </button>
            ) : null}
          </div>
          <Button type="submit" loading={pending}>
            {pending ? "Saving…" : "Save and continue"}
          </Button>
        </form>
      ) : null}

      {step === 2 ? (
        <form
          className="space-y-4"
          onSubmit={contactForm.handleSubmit(async (values) => {
            const result = await run(() => saveContactAction({ ...values, caseId }));
            if (result) setStep(3);
          })}
        >
          <p className="text-sm text-ink-2">Who should our team call if a document needs to be checked?</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactName">Name</Label>
              <Input id="contactName" {...contactForm.register("contactName")} />
              <FieldError message={contactForm.formState.errors.contactName?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Phone</Label>
              <Input id="contactPhone" {...contactForm.register("contactPhone")} />
              <FieldError message={contactForm.formState.errors.contactPhone?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email</Label>
              <Input id="contactEmail" type="email" {...contactForm.register("contactEmail")} />
              <FieldError message={contactForm.formState.errors.contactEmail?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactRelationship">Relationship</Label>
              <select id="contactRelationship" className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm" {...contactForm.register("contactRelationship")}>
                {relationships.map((value) => (
                  <option key={value} value={value}>
                    {RELATIONSHIP_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            {relationship === "OTHER" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="contactRelationshipOther">Describe the relationship</Label>
                <Input id="contactRelationshipOther" {...contactForm.register("contactRelationshipOther")} />
              </div>
            ) : null}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? "Saving…" : "Save and continue"}
            </Button>
          </div>
        </form>
      ) : null}

      {step === 3 ? (
        <form
          className="space-y-5"
          onSubmit={documentsForm.handleSubmit(async (values) => {
            const result = await run(() => saveDocumentsAction({ ...values, caseId }));
            if (!result || !("documents" in result) || !result.documents) return;
            setDocuments(result.documents);
            setStep(4);
          })}
        >
          {documentFields.fields.map((field, index) => {
            const type = documentsForm.watch(`documents.${index}.documentType`);
            return (
              <fieldset key={field.id} className="space-y-3 rounded-lg border border-line bg-surface p-4">
                <legend className="px-1 text-sm font-semibold">Document {index + 1}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Type</Label>
                    <select className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm" {...documentsForm.register(`documents.${index}.documentType`)}>
                      {titleDocumentTypes
                        .filter((item) => state?.documentTypes.includes(item))
                        .map((item) => (
                          <option key={item} value={item}>
                            {DOCUMENT_LABELS[item]}
                          </option>
                        ))}
                    </select>
                  </div>
                  {type === "CERTIFICATE_OF_OCCUPANCY" ? (
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <input type="checkbox" {...documentsForm.register(`documents.${index}.isGlobalCofO`)} />
                      This is a Global C of O
                    </label>
                  ) : null}
                  {type === "OTHER" ? (
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Document name</Label>
                      <Input {...documentsForm.register(`documents.${index}.otherTypeLabel`)} />
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label>Name on document</Label>
                    <Input {...documentsForm.register(`documents.${index}.nameOnDocument`)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Registration number</Label>
                    <Input {...documentsForm.register(`documents.${index}.registrationNumber`)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Volume</Label>
                    <Input {...documentsForm.register(`documents.${index}.volume`)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Page</Label>
                    <Input {...documentsForm.register(`documents.${index}.page`)} />
                  </div>
                  <div className="space-y-2">
                    <Label>File number</Label>
                    <Input {...documentsForm.register(`documents.${index}.fileNumber`)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date of issue</Label>
                    <Input type="date" {...documentsForm.register(`documents.${index}.issuedOn`)} />
                  </div>
                </div>
                {documentsForm.formState.errors.documents?.[index]?.nameOnDocument ? (
                  <FieldError message={documentsForm.formState.errors.documents[index]?.nameOnDocument?.message} />
                ) : null}
                {documentsForm.formState.errors.documents?.[index]?.registrationNumber ? (
                  <FieldError message={documentsForm.formState.errors.documents[index]?.registrationNumber?.message} />
                ) : null}
                {documentFields.fields.length > 1 ? (
                  <button type="button" className="text-sm font-semibold text-risk" onClick={() => documentFields.remove(index)}>
                    Remove document
                  </button>
                ) : null}
              </fieldset>
            );
          })}
          <button
            type="button"
            className="text-sm font-semibold text-seal"
            onClick={() => documentFields.append(stripFiles(emptyDoc()))}
          >
            Add another document
          </button>
          <div className="flex gap-3">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? "Saving…" : "Save and continue"}
            </Button>
          </div>
        </form>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          {documents.map((document) => (
            <div key={document.id} className="space-y-3 rounded-lg border border-line bg-surface p-4">
              <h2 className="font-serif text-xl">{DOCUMENT_LABELS[document.documentType]}</h2>
              <p className="text-sm text-ink-2">{document.nameOnDocument}</p>
              <label className="block text-sm font-semibold">
                Upload PDF, JPG, or PNG, up to 20MB
                <input
                  className="mt-2 block w-full text-sm"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  disabled={pending}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file || !document.id) return;
                    setPending(true);
                    setUploadingId(document.id);
                    setError("");
                    try {
                      const body = new FormData();
                      body.set("file", file);
                      body.set("titleDocumentId", document.id);
                      const response = await fetch("/api/uploads", { method: "POST", body });
                      const payload = (await response.json()) as { error?: string; file?: DocDraft["files"][number] };
                      if (!response.ok || !payload.file) {
                        setError(payload.error || "Upload failed");
                        return;
                      }
                      setDocuments((current) =>
                        current.map((item) => (item.id === document.id ? { ...item, files: [payload.file!] } : item)),
                      );
                    } catch {
                      setError("Upload failed. Check your connection and try again.");
                    } finally {
                      setPending(false);
                      setUploadingId(null);
                    }
                  }}
                />
              </label>
              {uploadingId === document.id ? (
                <p role="status" className="flex items-center gap-2 text-sm text-ink-2">
                  <Spinner className="text-seal" />
                  Uploading, please wait…
                </p>
              ) : null}
              <ul className="space-y-2 text-sm">
                {document.files.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-3">
                    <span>{file.name}</span>
                    {file.previewPath ? (
                      file.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={file.previewPath} alt="" className="h-16 w-16 rounded object-cover" />
                      ) : (
                        <a className="font-semibold text-seal" href={file.previewPath}>
                          Preview
                        </a>
                      )
                    ) : (
                      <a className="font-semibold text-seal" href={`/api/files/${file.id}`}>
                        Open
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button
              type="button"
              disabled={pending || documents.every((document) => document.files.length === 0)}
              onClick={() => setStep(5)}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!selectedTier) return;
            const result = await run(() => saveTierAction({ caseId, tierId: selectedTier.id }));
            if (result) {
              setTierId(selectedTier.id);
              setStep(6);
            }
          }}
        >
          <div className="grid gap-3">
            {state?.tiers.map((tier) => (
              <label key={tier.id} className={`block cursor-pointer rounded-lg border p-4 ${selectedTier?.id === tier.id ? "border-seal bg-seal-wash" : "border-line bg-surface"}`}>
                <input
                  className="sr-only"
                  type="radio"
                  name="tier"
                  checked={selectedTier?.id === tier.id}
                  onChange={() => setTierId(tier.id)}
                />
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-serif text-2xl">{tier.name}</span>
                  <span className="font-semibold">{formatNairaFromKobo(tier.priceKobo)}</span>
                </span>
                <span className="mt-1 block text-sm text-ink-2">{turnaroundLabel(tier.turnaroundMinDays, tier.turnaroundMaxDays)}</span>
                <span className="mt-2 block text-sm">{tier.description}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setStep(4)}>
              Back
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? "Saving…" : "Continue"}
            </Button>
          </div>
        </form>
      ) : null}

      {step === 6 && selectedTier ? (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const parsed = submitSchema.safeParse({ caseId, consent });
            if (!parsed.success) {
              setError(parsed.error.issues[0]?.message ?? "Confirm consent to continue");
              return;
            }
            const result = await run(() => submitCaseAction(parsed.data));
            if (result && "caseId" in result && result.caseId) {
              // run() has cleared the spinner; turn it back on until the case page has loaded.
              setPending(true);
              router.push(`/dashboard/verifications/${result.caseId}`);
            }
          }}
        >
          <div className="rounded-lg border border-line bg-surface p-4 text-sm">
            <p className="font-semibold">{selectedTier.name}</p>
            <p>{formatNairaFromKobo(selectedTier.priceKobo)} · {turnaroundLabel(selectedTier.turnaroundMinDays, selectedTier.turnaroundMaxDays)}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {summary.map((document) => (
                <li key={document.id}>{DOCUMENT_LABELS[document.documentType]} — {document.nameOnDocument}</li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-ink-2">
            Submitting saves the request. Payment is a separate step on the next page. The registry search does not start until Paystack confirms the fee.
          </p>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} />
            <span>I agree that VerifyTitle Nigeria may store these documents and personal details to carry out this search, as described in the privacy policy.</span>
          </label>
          <div className="flex gap-3">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setStep(5)}>
              Back
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function stripFiles(document: DocDraft) {
  return {
    id: document.id,
    documentType: document.documentType,
    otherTypeLabel: document.otherTypeLabel,
    isGlobalCofO: document.isGlobalCofO,
    registrationNumber: document.registrationNumber,
    volume: document.volume,
    page: document.page,
    fileNumber: document.fileNumber,
    issuedOn: document.issuedOn,
    nameOnDocument: document.nameOnDocument,
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-risk">{message}</p>;
}
