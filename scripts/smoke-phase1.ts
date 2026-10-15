/**
 * Phase 1 smoke test against a running dev server and the local database.
 * Run with: npm run smoke   (needs `npm run db:up` and `npm run dev`)
 */
import { createHmac } from "crypto";
import { PrismaClient } from "@prisma/client";
import { hashOtp } from "@/lib/crypto";
import {
  saveContactStep,
  saveDocumentsStep,
  savePropertyStep,
  saveTierStep,
  submitCase,
} from "@/server/cases/requests";
import { settleVerifiedPayment, verifyPaystackSignature } from "@/server/paystack";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3001";
const prisma = new PrismaClient();
const results: { name: string; ok: boolean; detail?: string }[] = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
}

class Jar {
  cookies = new Map<string, string>();
  absorb(response: Response) {
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const index = pair.indexOf("=");
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
  }
  header() {
    return [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; ");
  }
}

async function signIn(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.otpChallenge.create({
    data: {
      userId: user.id,
      channel: "EMAIL",
      destination: email,
      codeHash: hashOtp("424242"),
      expiresAt: new Date(Date.now() + 5 * 60_000),
    },
  });
  const jar = new Jar();
  const csrf = await fetch(`${BASE}/api/auth/csrf`);
  jar.absorb(csrf);
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const response = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar.header() },
    body: new URLSearchParams({ csrfToken, destination: email, code: "424242", callbackUrl: `${BASE}/dashboard` }),
  });
  jar.absorb(response);
  return { jar, user };
}

async function get(jar: Jar, path: string) {
  const response = await fetch(`${BASE}${path}`, { redirect: "manual", headers: { Cookie: jar.header() } });
  return { status: response.status, location: response.headers.get("location"), body: await response.text() };
}

async function main() {
  const customer = await signIn("customer@titlecheck.test");
  check("customer session cookie issued", [...customer.jar.cookies.keys()].some((key) => key.includes("session-token")));

  const wrongCode = new Jar();
  const csrf = await fetch(`${BASE}/api/auth/csrf`);
  wrongCode.absorb(csrf);
  const token = ((await csrf.json()) as { csrfToken: string }).csrfToken;
  const bad = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: wrongCode.header() },
    body: new URLSearchParams({ csrfToken: token, destination: "customer@titlecheck.test", code: "000001" }),
  });
  wrongCode.absorb(bad);
  check("wrong code gets no session", ![...wrongCode.cookies.keys()].some((key) => key.includes("session-token")));

  const dashboard = await get(customer.jar, "/dashboard");
  check("customer dashboard renders", dashboard.status === 200 && dashboard.body.includes("TC-LAG-2026-900005"), `status ${dashboard.status}`);
  const admin = await get(customer.jar, "/admin");
  check("customer cannot open /admin", admin.status === 307 || admin.status === 302, `status ${admin.status}`);

  const lagos = await prisma.state.findUniqueOrThrow({ where: { code: "LAG" }, include: { lgas: true } });
  const ikeja = lagos.lgas.find((lga) => lga.slug === "ikeja")!;
  const gold = await prisma.tier.findUniqueOrThrow({ where: { slug: "gold" } });

  const caseId = await savePropertyStep(customer.user.id, {
    addressLine: "7 Smoke Test Close, Opebi, Ikeja",
    stateId: lagos.id,
    lgaId: ikeja.id,
    latitude: 6.5967,
    longitude: 3.3561,
  });
  const created = await prisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
  check("case code format", /^TC-LAG-2026-\d{6}$/.test(created.code), created.code);
  check("new case starts as unsubmitted PENDING_PAYMENT", created.status === "PENDING_PAYMENT" && !created.submittedAt);

  let rejectedLga = false;
  try {
    const ogun = await prisma.state.findUniqueOrThrow({ where: { code: "OGU" } });
    await savePropertyStep(customer.user.id, { addressLine: "Somewhere in Abeokuta", stateId: ogun.id, lgaId: ikeja.id });
  } catch {
    rejectedLga = true;
  }
  check("rejects an LGA from another state", rejectedLga);

  await saveContactStep(customer.user.id, {
    caseId,
    contactName: "Mrs. Bisi Smoke",
    contactPhone: "+2348031112222",
    contactEmail: "bisi@example.com",
    contactRelationship: "SELLER",
  });
  const documents = await saveDocumentsStep(customer.user.id, caseId, [
    { documentType: "CERTIFICATE_OF_OCCUPANCY", registrationNumber: "12/12/2015", volume: "2015N", page: "12", nameOnDocument: "Bisi Smoke" },
  ]);
  await saveTierStep(customer.user.id, caseId, gold.id);
  const priced = await prisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
  check("tier price snapshot is ₦150,000 in kobo", priced.priceKobo === 15_000_000, String(priced.priceKobo));

  let blockedWithoutFile = false;
  try {
    await submitCase(customer.user.id, caseId, true);
  } catch {
    blockedWithoutFile = true;
  }
  check("submit blocked until a file is uploaded", blockedWithoutFile);

  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  const form = new FormData();
  form.set("titleDocumentId", documents[0].id);
  form.set("file", new Blob([pdf], { type: "application/pdf" }), "c-of-o.pdf");
  const upload = await fetch(`${BASE}/api/uploads`, { method: "POST", body: form, headers: { Cookie: customer.jar.header() } });
  const uploaded = (await upload.json()) as { file?: { id: string } };
  check("PDF upload accepted", upload.status === 200 && Boolean(uploaded.file?.id), `status ${upload.status}`);

  const fake = new FormData();
  fake.set("titleDocumentId", documents[0].id);
  fake.set("file", new Blob([Buffer.from("MZ not a pdf")], { type: "application/pdf" }), "evil.pdf");
  const fakeUpload = await fetch(`${BASE}/api/uploads`, { method: "POST", body: fake, headers: { Cookie: customer.jar.header() } });
  check("non-PDF bytes with a PDF name are rejected", fakeUpload.status === 415, `status ${fakeUpload.status}`);

  if (uploaded.file?.id) {
    const open = await get(customer.jar, `/api/files/${uploaded.file.id}`);
    check("file opens through a signed redirect", open.status === 307 && Boolean(open.location?.includes("sig=")), `status ${open.status}`);
    if (open.location) {
      const content = await fetch(open.location, { headers: { Cookie: customer.jar.header() } });
      check("signed link serves the file", content.status === 200 && (await content.text()).startsWith("%PDF"), `status ${content.status}`);
      const tampered = await fetch(open.location.replace(/sig=[^&]+/, "sig=forged"), { headers: { Cookie: customer.jar.header() } });
      check("tampered signature is refused", tampered.status === 403, `status ${tampered.status}`);
    }

    const field = await signIn("field@titlecheck.test");
    const stranger = await get(field.jar, `/api/files/${uploaded.file.id}`);
    check("unassigned staff cannot open the customer's file", stranger.status === 404, `status ${stranger.status}`);

    const viewed = await prisma.auditLog.count({ where: { action: "FILE_VIEWED", entityId: uploaded.file.id } });
    check("file view written to the audit log", viewed >= 1, String(viewed));
  }

  await submitCase(customer.user.id, caseId, true);
  const submitted = await prisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
  check("submitted case still awaits payment", submitted.status === "PENDING_PAYMENT" && Boolean(submitted.submittedAt));
  const page = await get(customer.jar, `/dashboard/verifications/${caseId}`);
  check("case page shows the pay button", page.status === 200 && page.body.includes("Pay with Paystack"), `status ${page.status}`);

  const key = "sk_test_smoke";
  process.env.PAYSTACK_SECRET_KEY = key;
  const body = JSON.stringify({ event: "charge.success", data: { reference: "x" } });
  const good = createHmac("sha512", key).update(body).digest("hex");
  check("webhook signature accepted when correct", verifyPaystackSignature(body, good));
  check("webhook signature rejected when forged", !verifyPaystackSignature(body, "0".repeat(128)));
  delete process.env.PAYSTACK_SECRET_KEY;

  await prisma.payment.create({
    data: { caseId, userId: customer.user.id, paystackReference: `smoke_short_${caseId}`, amountKobo: submitted.priceKobo },
  });
  const short = await settleVerifiedPayment({
    reference: `smoke_short_${caseId}`,
    amountKobo: submitted.priceKobo - 100,
    currency: "NGN",
    status: "success",
  });
  const afterShort = await prisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
  check("underpayment does not mark the case paid", !short.ok && afterShort.status === "PENDING_PAYMENT");

  await prisma.payment.create({
    data: { caseId, userId: customer.user.id, paystackReference: `smoke_full_${caseId}`, amountKobo: submitted.priceKobo },
  });
  await settleVerifiedPayment({ reference: `smoke_full_${caseId}`, amountKobo: submitted.priceKobo, currency: "NGN", status: "success" });
  const repeat = await settleVerifiedPayment({ reference: `smoke_full_${caseId}`, amountKobo: submitted.priceKobo, currency: "NGN", status: "success" });
  const paid = await prisma.verificationCase.findUniqueOrThrow({ where: { id: caseId }, include: { events: true } });
  check("matching payment marks the case PAID", paid.status === "PAID" && Boolean(paid.paidAt));
  check("repeat confirmation is idempotent", repeat.ok && "already" in repeat && repeat.already === true && paid.events.filter((event) => event.status === "PAID").length === 1);

  let auditLocked = false;
  try {
    await prisma.$executeRawUnsafe(`UPDATE "AuditLog" SET "entityType" = 'tampered' WHERE id = (SELECT id FROM "AuditLog" LIMIT 1)`);
  } catch {
    auditLocked = true;
  }
  check("AuditLog rejects UPDATE", auditLocked);

  const staff = await prisma.caseTask.count({ where: { caseId } });
  check("no staff tasks are created in Phase 1", staff === 0, String(staff));

  for (const result of results) {
    console.info(`${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.ok || !result.detail ? "" : `  (${result.detail})`}`);
  }
  const failed = results.filter((result) => !result.ok).length;
  console.info(`\n${results.length - failed}/${results.length} passed`);
  process.exitCode = failed ? 1 : 0;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
