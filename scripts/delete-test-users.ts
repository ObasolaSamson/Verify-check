/**
 * One-off cleanup: deletes every user who is NOT an ADMIN, plus everything linked to them
 * (verification codes, sessions, cases, documents, uploaded files, payments, agent profiles, reviews, audit entries).
 *
 * It shows who will be deleted and what is linked to them, then waits for you to type a confirmation phrase.
 * Everything in the database is deleted in ONE transaction: if anything fails, nothing is deleted.
 *
 *   npm run db:delete-test-users                       show the list, ask, then delete
 *   npm run db:delete-test-users -- --dry-run          show the list and stop
 *   npm run db:delete-test-users -- --keep=a@x.com,b@y.com   also keep these email addresses
 *
 * It uses DIRECT_URL when set (needed for the Supabase pooler), otherwise DATABASE_URL.
 */
import { unlink } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { Prisma, PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const keepEmails = new Set(
  (args.find((arg) => arg.startsWith("--keep="))?.slice("--keep=".length) ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("No DATABASE_URL or DIRECT_URL found. Nothing was changed.");
  process.exit(1);
}
const host = new URL(databaseUrl).hostname;
const isLocal = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

type Db = Prisma.TransactionClient | PrismaClient;

const line = (text = "") => console.log(text);
const pad = (value: string, width: number) => (value.length > width ? `${value.slice(0, width - 1)}…` : value.padEnd(width));

/** Finds every record that belongs to the users being deleted. */
async function collect(db: Db, userIds: string[], emails: string[], phones: string[]) {
  const cases = await db.verificationCase.findMany({ where: { customerId: { in: userIds } }, select: { id: true } });
  const caseIds = cases.map((row) => row.id);

  const tasks = await db.caseTask.findMany({ where: { caseId: { in: caseIds } }, select: { id: true } });
  const taskIds = tasks.map((row) => row.id);

  const agents = await db.agentProfile.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const agentIds = agents.map((row) => row.id);

  const listings = await db.rentalListing.findMany({ where: { agentProfileId: { in: agentIds } }, select: { id: true } });
  const listingIds = listings.map((row) => row.id);

  const reviews = await db.review.findMany({
    where: { OR: [{ authorId: { in: userIds } }, { agentProfileId: { in: agentIds } }, { rentalListingId: { in: listingIds } }] },
    select: { id: true },
  });
  const reviewIds = reviews.map((row) => row.id);

  const payments = await db.payment.findMany({ where: { caseId: { in: caseIds } }, select: { id: true, paystackReference: true } });
  const paymentIds = payments.map((row) => row.id);
  const paymentRefs = payments.map((row) => row.paystackReference);

  const fileIds = new Set<string>();
  const addAll = (rows: (string | null)[]) => rows.forEach((id) => id && fileIds.add(id));
  addAll((await db.storedFile.findMany({ where: { uploadedById: { in: userIds } }, select: { id: true } })).map((row) => row.id));
  addAll((await db.titleDocumentFile.findMany({ where: { titleDocument: { caseId: { in: caseIds } } }, select: { fileId: true } })).map((row) => row.fileId));
  addAll((await db.evidence.findMany({ where: { taskId: { in: taskIds } }, select: { fileId: true } })).map((row) => row.fileId));
  addAll((await db.sitePhoto.findMany({ where: { caseId: { in: caseIds } }, select: { fileId: true } })).map((row) => row.fileId));
  addAll((await db.report.findMany({ where: { caseId: { in: caseIds } }, select: { pdfFileId: true } })).map((row) => row.pdfFileId));
  addAll((await db.surveyCharting.findMany({ where: { taskId: { in: taskIds } }, select: { reportFileId: true } })).map((row) => row.reportFileId));
  addAll((await db.agentProfile.findMany({ where: { id: { in: agentIds } }, select: { photoFileId: true } })).map((row) => row.photoFileId));
  addAll((await db.agentLicence.findMany({ where: { agentProfileId: { in: agentIds } }, select: { certificateFileId: true } })).map((row) => row.certificateFileId));
  addAll((await db.listingPhoto.findMany({ where: { listingId: { in: listingIds } }, select: { fileId: true } })).map((row) => row.fileId));
  const files = await db.storedFile.findMany({ where: { id: { in: [...fileIds] } }, select: { id: true, bucket: true, objectKey: true } });

  const otpWhere: Prisma.OtpChallengeWhereInput = {
    OR: [
      { userId: { in: userIds } },
      { destination: { in: [...emails, ...phones] } },
      { destination: { in: userIds.map((id) => `ticket:${id}`) } },
    ],
  };
  const tokenIdentifiers = emails.map((email) => `email-verify:${email}`);
  const auditEntityIds = [...userIds, ...caseIds, ...files.map((file) => file.id), ...paymentIds];
  const auditWhere: Prisma.AuditLogWhereInput = {
    OR: [{ actorId: { in: userIds } }, { entityId: { in: auditEntityIds } }],
  };

  return { caseIds, taskIds, agentIds, listingIds, reviewIds, paymentIds, paymentRefs, files, otpWhere, tokenIdentifiers, auditWhere };
}

/** Removes uploaded files from disk or Supabase Storage. Runs after the database delete has committed. */
async function removeStoredObjects(files: { bucket: string; objectKey: string }[]) {
  const failures: string[] = [];
  const local = files.filter((file) => file.bucket === "local");
  const remote = files.filter((file) => file.bucket !== "local");

  const root = path.join(process.cwd(), ".data", "uploads");
  for (const file of local) {
    const target = path.resolve(root, file.objectKey);
    if (!target.startsWith(root + path.sep)) {
      failures.push(`local:${file.objectKey} (unsafe path, skipped)`);
      continue;
    }
    try {
      await unlink(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") failures.push(`local:${file.objectKey} (${(error as Error).message})`);
    }
  }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const buckets = [...new Set(remote.map((file) => file.bucket))];
  for (const bucket of buckets) {
    const keys = remote.filter((file) => file.bucket === bucket).map((file) => file.objectKey);
    if (!base || !key) {
      failures.push(...keys.map((objectKey) => `${bucket}:${objectKey} (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set)`));
      continue;
    }
    for (let i = 0; i < keys.length; i += 100) {
      const chunk = keys.slice(i, i + 100);
      const response = await fetch(`${base}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: chunk }),
      });
      if (!response.ok) failures.push(...chunk.map((objectKey) => `${bucket}:${objectKey} (Supabase ${response.status})`));
    }
  }
  return failures;
}

async function auditTriggerState(db: Db) {
  const rows = await db.$queryRaw<{ tgenabled: string }[]>`
    SELECT tgenabled FROM pg_trigger WHERE tgname = 'audit_log_no_update' AND NOT tgisinternal`;
  return rows[0]?.tgenabled ?? null; // "O" = enabled, "D" = disabled, null = no such trigger
}

async function main() {
  const everyone = await prisma.user.findMany({
    include: {
      userRoles: { include: { role: true } },
      _count: { select: { customerCases: true, payments: true, uploadedFiles: true, sessions: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const isAdmin = (user: (typeof everyone)[number]) => user.userRoles.some((row) => row.role.key === "ADMIN");
  const keptByFlag = (user: (typeof everyone)[number]) => Boolean(user.email && keepEmails.has(user.email.toLowerCase()));

  const kept = everyone.filter((user) => isAdmin(user) || keptByFlag(user));
  const doomed = everyone.filter((user) => !isAdmin(user) && !keptByFlag(user));

  line("=".repeat(78));
  line(" DELETE TEST USERS");
  line("=".repeat(78));
  line(` Database : ${host}   ${isLocal ? "(this computer)" : "*** REMOTE DATABASE: this is NOT your laptop ***"}`);
  line();

  line(`KEPT (${kept.length}): admins${keepEmails.size ? " and --keep addresses" : ""}`);
  if (kept.length === 0) line("   (none)");
  for (const user of kept) {
    line(`   ${pad(user.email ?? user.phone ?? user.id, 36)} ${pad(user.name ?? "", 22)} ${user.userRoles.map((row) => row.role.key).join(", ")}`);
  }
  line();

  if (doomed.length === 0) {
    line("There are no non-admin users. Nothing to delete.");
    return;
  }

  line(`WILL BE DELETED (${doomed.length}):`);
  line(`   ${pad("email / phone", 36)} ${pad("name", 22)} ${pad("roles", 18)} cases pay files  signed up`);
  for (const user of doomed) {
    const roles = user.userRoles.map((row) => row.role.key).join(", ") || "(none)";
    line(
      `   ${pad(user.email ?? user.phone ?? user.id, 36)} ${pad(user.name ?? "", 22)} ${pad(roles, 18)} ${String(user._count.customerCases).padStart(5)} ${String(user._count.payments).padStart(3)} ${String(user._count.uploadedFiles).padStart(5)}  ${user.createdAt.toISOString().slice(0, 10)}`,
    );
  }
  line();

  const userIds = doomed.map((user) => user.id);
  const emails = doomed.map((user) => user.email?.toLowerCase()).filter((value): value is string => Boolean(value));
  const phones = doomed.map((user) => user.phone).filter((value): value is string => Boolean(value));
  const plan = await collect(prisma, userIds, emails, phones);
  const counts = {
    sessions: await prisma.session.count({ where: { userId: { in: userIds } } }),
    codes: await prisma.otpChallenge.count({ where: plan.otpWhere }),
    audit: await prisma.auditLog.count({ where: plan.auditWhere }),
  };
  line("Also deleted along with them:");
  line(`   ${plan.caseIds.length} verification case(s), with their documents, tasks, notes and reports`);
  line(`   ${plan.paymentIds.length} payment(s)`);
  line(`   ${plan.files.length} uploaded file(s), removed from storage too`);
  line(`   ${plan.agentIds.length} agent profile(s), ${plan.listingIds.length} listing(s), ${plan.reviewIds.length} review(s)`);
  line(`   ${counts.codes} verification code(s) and ${counts.sessions} session(s)`);
  line(`   ${counts.audit} audit log entr${counts.audit === 1 ? "y" : "ies"} about these users`);
  line();
  if (counts.audit > 0) {
    line("NOTE: the audit log is normally protected so nobody can edit or delete it. To remove these entries this");
    line("      script switches that protection off for ONE transaction, then switches it back on and checks it.");
    line();
  }
  if (!everyone.some(isAdmin)) {
    line("WARNING: there is NO admin user in this database. After this you would have nobody to sign in as an admin.");
    line();
  }
  line("This script cannot tell test users from real ones. It deletes EVERY non-admin account listed above.");
  line("This cannot be undone.");
  line();

  if (dryRun) {
    line("Dry run only. Nothing was deleted.");
    return;
  }
  if (!process.stdin.isTTY) {
    console.error("This needs a person at the keyboard to confirm. Run it directly in a terminal. Nothing was deleted.");
    process.exitCode = 1;
    return;
  }

  const phrase = `delete ${doomed.length} user${doomed.length === 1 ? "" : "s"}`;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let answer = "";
  try {
    answer = (await rl.question(`Type "${phrase}" to confirm (anything else cancels): `)).trim();
  } catch {
    // Ctrl+D or a closed terminal counts as "no".
  } finally {
    rl.close();
  }
  if (answer !== phrase) {
    line();
    line("Cancelled. Nothing was deleted.");
    return;
  }
  line();
  line("Deleting...");

  const removed: Record<string, number> = {};
  const del = async (label: string, run: Promise<{ count: number }>) => {
    const { count } = await run;
    if (count > 0) removed[label] = (removed[label] ?? 0) + count;
  };

  let files: { bucket: string; objectKey: string }[] = [];
  try {
    await prisma.$transaction(
      async (tx) => {
        // Recompute inside the transaction so the delete matches the database at this moment.
        const p = await collect(tx, userIds, emails, phones);
        files = p.files;
        const caseIds = { in: p.caseIds };
        const taskIds = { in: p.taskIds };

        // Reviews and reports about agents or listings, and reviews these users wrote.
        await del("review scores", tx.reviewScore.deleteMany({ where: { reviewId: { in: p.reviewIds } } }));
        await del("review revisions", tx.reviewRevision.deleteMany({ where: { reviewId: { in: p.reviewIds } } }));
        await del("review replies", tx.reviewReply.deleteMany({ where: { OR: [{ reviewId: { in: p.reviewIds } }, { authorId: { in: userIds } }] } }));
        await del("review reports", tx.reviewReport.deleteMany({ where: { OR: [{ reviewId: { in: p.reviewIds } }, { reporterId: { in: userIds } }] } }));
        await del("reviews", tx.review.deleteMany({ where: { id: { in: p.reviewIds } } }));
        await del("fraud reports", tx.fraudReport.deleteMany({ where: { OR: [{ reporterId: { in: userIds } }, { agentProfileId: { in: p.agentIds } }] } }));

        // Cases, deepest records first.
        await del("task findings", tx.taskFinding.deleteMany({ where: { taskId: taskIds } }));
        await del("registry searches", tx.registrySearch.deleteMany({ where: { taskId: taskIds } }));
        await del("survey chartings", tx.surveyCharting.deleteMany({ where: { taskId: taskIds } }));
        await del("task notes", tx.taskNote.deleteMany({ where: { taskId: taskIds } }));
        await del("legal reviews", tx.legalReview.deleteMany({ where: { taskId: taskIds } }));
        await del("evidence", tx.evidence.deleteMany({ where: { taskId: taskIds } }));
        await del("site photos", tx.sitePhoto.deleteMany({ where: { caseId: caseIds } }));
        await del("tasks", tx.caseTask.deleteMany({ where: { caseId: caseIds } }));
        await del("case events", tx.caseEvent.deleteMany({ where: { caseId: caseIds } }));
        await del("notifications", tx.notification.deleteMany({ where: { OR: [{ caseId: caseIds }, { userId: { in: userIds } }] } }));
        await del("payments", tx.payment.deleteMany({ where: { caseId: caseIds } }));
        await del("paystack events", tx.paystackEvent.deleteMany({ where: { reference: { in: p.paymentRefs } } }));
        await del("reports", tx.report.deleteMany({ where: { caseId: caseIds } }));
        await del("document files", tx.titleDocumentFile.deleteMany({ where: { titleDocument: { caseId: caseIds } } }));
        await del("documents", tx.titleDocument.deleteMany({ where: { caseId: caseIds } }));
        await del("cases", tx.verificationCase.deleteMany({ where: { id: caseIds } }));
        await del("properties", tx.property.deleteMany({ where: { createdById: { in: userIds } } }));

        // Agent profiles.
        await del("kyc checks", tx.kycCheck.deleteMany({ where: { agentProfileId: { in: p.agentIds } } }));
        await del("agent licences", tx.agentLicence.deleteMany({ where: { agentProfileId: { in: p.agentIds } } }));
        await del("listing photos", tx.listingPhoto.deleteMany({ where: { listingId: { in: p.listingIds } } }));
        await del("listings", tx.rentalListing.deleteMany({ where: { id: { in: p.listingIds } } }));
        await del("agent profiles", tx.agentProfile.deleteMany({ where: { id: { in: p.agentIds } } }));

        // Files (database rows). The actual objects are removed after the commit.
        await del("files", tx.storedFile.deleteMany({ where: { id: { in: p.files.map((file) => file.id) } } }));

        // People-owned records.
        await del("consent records", tx.consentRecord.deleteMany({ where: { userId: { in: userIds } } }));
        await del("data requests", tx.dataSubjectRequest.deleteMany({ where: { userId: { in: userIds } } }));
        await del("sessions", tx.session.deleteMany({ where: { userId: { in: userIds } } }));
        await del("accounts", tx.account.deleteMany({ where: { userId: { in: userIds } } }));
        await del("verification codes", tx.otpChallenge.deleteMany({ where: p.otpWhere }));
        await del("email confirmation links", tx.verificationToken.deleteMany({ where: { identifier: { in: p.tokenIdentifiers } } }));
        await del("staff profiles", tx.staffProfile.deleteMany({ where: { userId: { in: userIds } } }));
        await del("user roles", tx.userRole.deleteMany({ where: { userId: { in: userIds } } }));

        // Audit log: protected by a trigger. Switch it off, delete, switch it on again. All inside this transaction.
        const state = await auditTriggerState(tx);
        if (state !== null) await tx.$executeRawUnsafe('ALTER TABLE "AuditLog" DISABLE TRIGGER audit_log_no_update');
        await del("audit log entries", tx.auditLog.deleteMany({ where: p.auditWhere }));
        if (state !== null) await tx.$executeRawUnsafe('ALTER TABLE "AuditLog" ENABLE TRIGGER audit_log_no_update');

        await del("users", tx.user.deleteMany({ where: { id: { in: userIds } } }));
      },
      { timeout: 120_000, maxWait: 20_000 },
    );
  } catch (error) {
    line();
    console.error("FAILED. The whole delete was rolled back, so NOTHING was deleted.");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      console.error("Something you are keeping still points at one of these users, so it cannot be removed.");
      console.error(`Constraint: ${String((error.meta as { constraint?: string; field_name?: string } | undefined)?.constraint ?? (error.meta as { field_name?: string } | undefined)?.field_name ?? "unknown")}`);
      console.error("Typical cause: an admin you kept owns a case or file that a deleted staff member worked on.");
    } else {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
    return;
  }

  line();
  line("Deleted from the database:");
  for (const [label, count] of Object.entries(removed)) line(`   ${String(count).padStart(5)}  ${label}`);

  const failures = await removeStoredObjects(files);
  line();
  line(`Stored files removed: ${files.length - failures.length} of ${files.length}`);
  if (failures.length > 0) {
    line("These objects could not be removed and may need deleting by hand:");
    failures.forEach((failure) => line(`   ${failure}`));
  }

  const trigger = await auditTriggerState(prisma);
  line();
  line(trigger === null ? "Audit log protection: no such trigger in this database (nothing to restore)." : trigger === "O" ? "Audit log protection: ON (restored and verified)." : "!!! Audit log protection is NOT enabled. Run prisma/sql/audit_log_immutable.sql to restore it.");
  const left = await prisma.user.count();
  line(`Users remaining: ${left}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
