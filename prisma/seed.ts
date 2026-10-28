import { PrismaClient, type CaseStatus, type CheckType, type RoleKey, type State, type TitleDocumentType } from "@prisma/client";

const prisma = new PrismaClient();

const LAGOS_LGAS = [
  "Agege",
  "Ajeromi-Ifelodun",
  "Alimosho",
  "Amuwo-Odofin",
  "Apapa",
  "Badagry",
  "Epe",
  "Eti-Osa",
  "Ibeju-Lekki",
  "Ifako-Ijaiye",
  "Ikeja",
  "Ikorodu",
  "Kosofe",
  "Lagos Island",
  "Lagos Mainland",
  "Mushin",
  "Ojo",
  "Oshodi-Isolo",
  "Somolu",
  "Surulere",
];

const ALL_DOCUMENT_TYPES: TitleDocumentType[] = [
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
];

const ROLE_LABELS: Record<RoleKey, string> = {
  CUSTOMER: "Customer",
  AGENT: "Agent",
  FIELD_OFFICER: "Field officer",
  SURVEYOR: "Surveyor",
  LAWYER: "Lawyer / reviewer",
  ADMIN: "Administrator",
};

type CheckSeed = { checkType: CheckType; assigneeRole: RoleKey; title: string; description: string; config?: object };

const STANDARD_CHECKS: CheckSeed[] = [
  {
    checkType: "REGISTRY_SEARCH",
    assigneeRole: "FIELD_OFFICER",
    title: "Land Registry search",
    description: "Search at the Lagos Land Registry, Alausa. Confirms registration, the registered owner, and the registration details.",
  },
];

const GOLD_EXTRA: CheckSeed[] = [
  {
    checkType: "SURVEY_CHARTING",
    assigneeRole: "SURVEYOR",
    title: "Survey plan charting",
    description: "Charts the plan to show whether the land is free, under government acquisition, committed, or in a setback or right of way.",
  },
  {
    checkType: "GAZETTE_CHECK",
    assigneeRole: "FIELD_OFFICER",
    title: "Gazette and excision check",
    description: "Checks the gazette where an excision or ratification is claimed.",
  },
  {
    checkType: "SITE_VISIT",
    assigneeRole: "FIELD_OFFICER",
    title: "Site visit",
    description: "A field officer visits the land and uploads geotagged photos.",
  },
  {
    checkType: "AGENT_CHECK",
    assigneeRole: "FIELD_OFFICER",
    title: "Agent check",
    description: "Checks the agent involved in the transaction.",
  },
];

const DIAMOND_EXTRA: CheckSeed[] = [
  {
    checkType: "ENCUMBRANCE_SEARCH",
    assigneeRole: "LAWYER",
    title: "Encumbrance search",
    description: "Looks for registered mortgages and caveats.",
  },
  {
    checkType: "LITIGATION_SEARCH",
    assigneeRole: "LAWYER",
    title: "Litigation search",
    description: "Looks for pending court cases over the land.",
  },
  {
    checkType: "COMMUNITY_CHECK",
    assigneeRole: "FIELD_OFFICER",
    title: "Family and community check",
    description: "Family, community, and omonile checks, with neighbour interviews.",
  },
];

function legalReview(depth: "summary" | "full"): CheckSeed {
  return {
    checkType: "LEGAL_REVIEW",
    assigneeRole: "LAWYER",
    title: depth === "full" ? "Signed legal opinion" : "Legal review",
    description:
      depth === "full"
        ? "A lawyer reviews every finding and signs a full legal opinion."
        : "A lawyer reviews the findings and sets the risk rating.",
    config: { opinionDepth: depth },
  };
}

const TIERS = [
  {
    slug: "standard",
    name: "Standard",
    description: "Document desk review and a Land Registry search at Alausa.",
    priceKobo: 50_000_00,
    turnaroundMinDays: 5,
    turnaroundMaxDays: 7,
    isPriority: false,
    includesCaseManager: false,
    sortOrder: 1,
    checks: [...STANDARD_CHECKS, legalReview("summary")],
  },
  {
    slug: "gold",
    name: "Gold",
    description: "Standard, plus survey charting, a site visit with geotagged photos, an agent check, and a gazette check where it applies.",
    priceKobo: 150_000_00,
    turnaroundMinDays: 7,
    turnaroundMaxDays: 10,
    isPriority: false,
    includesCaseManager: false,
    sortOrder: 2,
    checks: [...STANDARD_CHECKS, ...GOLD_EXTRA, legalReview("summary")],
  },
  {
    slug: "diamond",
    name: "Diamond",
    description: "Gold, plus encumbrance, litigation, and community checks, a signed legal opinion, priority handling, and a case manager who calls you.",
    priceKobo: 350_000_00,
    turnaroundMinDays: 3,
    turnaroundMaxDays: 5,
    isPriority: true,
    includesCaseManager: true,
    sortOrder: 3,
    checks: [...STANDARD_CHECKS, ...GOLD_EXTRA, ...DIAMOND_EXTRA, legalReview("full")],
  },
];

const USERS: { key: RoleKey; name: string; email: string; phone: string }[] = [
  { key: "CUSTOMER", name: "Adaeze Okafor", email: "customer@titlecheck.test", phone: "+2348010000001" },
  { key: "AGENT", name: "Tunde Bakare", email: "agent@titlecheck.test", phone: "+2348010000002" },
  { key: "FIELD_OFFICER", name: "Kehinde Adeyemi", email: "field@titlecheck.test", phone: "+2348010000003" },
  { key: "SURVEYOR", name: "Ibrahim Musa", email: "surveyor@titlecheck.test", phone: "+2348010000004" },
  { key: "LAWYER", name: "Funmi Adebayo", email: "lawyer@titlecheck.test", phone: "+2348010000005" },
  { key: "ADMIN", name: "Chidi Nwosu", email: "admin@titlecheck.test", phone: "+2348010000006" },
];

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**
 * Reference data the app cannot run without: roles, Lagos and its LGAs, registries, tiers and fees.
 * Safe for production. Idempotent: running it again updates rows instead of duplicating them.
 */
async function seedReference() {
  for (const [key, label] of Object.entries(ROLE_LABELS) as [RoleKey, string][]) {
    await prisma.role.upsert({ where: { key }, update: { label }, create: { key, label } });
  }

  const lagos = await prisma.state.upsert({
    where: { code: "LAG" },
    update: { active: true, name: "Lagos" },
    create: { code: "LAG", name: "Lagos", slug: "lagos", active: true },
  });
  for (const name of LAGOS_LGAS) {
    await prisma.lga.upsert({
      where: { stateId_slug: { stateId: lagos.id, slug: slug(name) } },
      update: { name },
      create: { stateId: lagos.id, name, slug: slug(name) },
    });
  }
  for (const documentType of ALL_DOCUMENT_TYPES) {
    await prisma.stateDocumentType.upsert({
      where: { stateId_documentType: { stateId: lagos.id, documentType } },
      update: { active: true },
      create: { stateId: lagos.id, documentType },
    });
  }

  const others = [
    { code: "FCT", name: "Federal Capital Territory", slug: "fct", registry: "Abuja Geographic Information Systems (AGIS)", address: "Area 11, Garki, Abuja", kind: "AGIS" as const },
    { code: "OGU", name: "Ogun", slug: "ogun", registry: "Ogun State Bureau of Lands and Survey", address: "Oke-Mosan, Abeokuta", kind: "LAND_REGISTRY" as const },
    { code: "RIV", name: "Rivers", slug: "rivers", registry: "Rivers State Ministry of Lands and Survey", address: "Port Harcourt", kind: "LAND_REGISTRY" as const },
  ];
  for (const item of others) {
    const state = await prisma.state.upsert({
      where: { code: item.code },
      update: {},
      create: { code: item.code, name: item.name, slug: item.slug, active: false },
    });
    const existing = await prisma.registryOffice.findFirst({ where: { stateId: state.id, name: item.registry } });
    if (!existing) {
      await prisma.registryOffice.create({
        data: { stateId: state.id, name: item.registry, address: item.address, kind: item.kind },
      });
    }
  }

  const lagosRegistries = [
    { name: "Lagos State Land Registry, Alausa", address: "Block 13, The Secretariat, Alausa, Ikeja", kind: "LAND_REGISTRY" as const },
    { name: "Office of the Surveyor-General of Lagos State", address: "The Secretariat, Alausa, Ikeja", kind: "SURVEYOR_GENERAL" as const },
  ];
  for (const registry of lagosRegistries) {
    const existing = await prisma.registryOffice.findFirst({ where: { stateId: lagos.id, name: registry.name } });
    if (!existing) await prisma.registryOffice.create({ data: { ...registry, stateId: lagos.id } });
  }

  const tierIds: Record<string, string> = {};
  for (const tier of TIERS) {
    const { checks, ...data } = tier;
    const row = await prisma.tier.upsert({ where: { slug: tier.slug }, update: data, create: data });
    tierIds[tier.slug] = row.id;
    await prisma.tierCheckTemplate.deleteMany({ where: { tierId: row.id, tasks: { none: {} } } });
    const remaining = await prisma.tierCheckTemplate.count({ where: { tierId: row.id } });
    if (remaining === 0) {
      await prisma.tierCheckTemplate.createMany({
        data: checks.map((check, index) => ({ ...check, tierId: row.id, sortOrder: index + 1 })),
      });
    }
    await prisma.stateTierFee.upsert({
      where: { stateId_tierId: { stateId: lagos.id, tierId: row.id } },
      update: { priceKobo: tier.priceKobo, turnaroundMinDays: tier.turnaroundMinDays, turnaroundMaxDays: tier.turnaroundMaxDays },
      create: {
        stateId: lagos.id,
        tierId: row.id,
        priceKobo: tier.priceKobo,
        turnaroundMinDays: tier.turnaroundMinDays,
        turnaroundMaxDays: tier.turnaroundMaxDays,
      },
    });
  }

  console.info("Seeded reference data: roles, Lagos, 3 inactive states, 3 tiers and fees.");
  return { lagos, tierIds };
}

/**
 * Demo accounts and fake cases for local development only.
 * Never run this against a live database: the accounts are known and include an admin.
 */
async function seedDemo({ lagos, tierIds }: { lagos: State; tierIds: Record<string, string> }) {
  const userIds: Partial<Record<RoleKey, string>> = {};
  for (const item of USERS) {
    const role = await prisma.role.findUniqueOrThrow({ where: { key: item.key } });
    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: { name: item.name, phone: item.phone },
      create: {
        name: item.name,
        email: item.email,
        phone: item.phone,
        emailVerified: new Date(),
        phoneVerified: new Date(),
        acceptedTermsVersion: "2026-10-14",
        acceptedTermsAt: new Date(),
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
    if (["FIELD_OFFICER", "SURVEYOR", "LAWYER"].includes(item.key)) {
      await prisma.staffProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          surconNumber: item.key === "SURVEYOR" ? "SURCON/R/2214" : null,
          states: { connect: { id: lagos.id } },
        },
      });
    }
    userIds[item.key] = user.id;
  }

  const customerId = userIds.CUSTOMER!;
  const existingSamples = await prisma.verificationCase.count({ where: { customerId, code: { startsWith: "TC-LAG-2026-9" } } });
  if (existingSamples === 0) {
    const ikeja = await prisma.lga.findFirstOrThrow({ where: { stateId: lagos.id, slug: "ikeja" } });
    const etiOsa = await prisma.lga.findFirstOrThrow({ where: { stateId: lagos.id, slug: "eti-osa" } });
    const ibeju = await prisma.lga.findFirstOrThrow({ where: { stateId: lagos.id, slug: "ibeju-lekki" } });

    const samples: {
      seq: number;
      status: CaseStatus;
      tier: string;
      address: string;
      lgaId: string;
      estate?: string;
      lat?: number;
      lng?: number;
    }[] = [
      { seq: 900001, status: "PENDING_PAYMENT", tier: "standard", address: "14 Allen Avenue, Ikeja", lgaId: ikeja.id, lat: 6.6018, lng: 3.3515 },
      { seq: 900002, status: "PAID", tier: "gold", address: "Plot 22, Admiralty Way, Lekki Phase 1", lgaId: etiOsa.id, estate: "Lekki Phase 1", lat: 6.4474, lng: 3.4723 },
      { seq: 900003, status: "IN_PROGRESS", tier: "gold", address: "Block C, Plot 9, Abijo GRA", lgaId: ibeju.id, estate: "Abijo GRA", lat: 6.4669, lng: 3.6482 },
      { seq: 900004, status: "UNDER_REVIEW", tier: "diamond", address: "5 Bourdillon Road, Ikoyi", lgaId: etiOsa.id, lat: 6.4494, lng: 3.4342 },
      { seq: 900005, status: "COMPLETED", tier: "standard", address: "31 Oba Akran Avenue, Ikeja", lgaId: ikeja.id, lat: 6.6111, lng: 3.3433 },
    ];

    for (const sample of samples) {
      const tier = TIERS.find((item) => item.slug === sample.tier)!;
      const paid = sample.status !== "PENDING_PAYMENT";
      const code = `TC-LAG-2026-${sample.seq}`;
      const property = await prisma.property.create({
        data: {
          createdById: customerId,
          addressLine: sample.address,
          stateId: lagos.id,
          lgaId: sample.lgaId,
          estateName: sample.estate ?? null,
          latitude: sample.lat ?? null,
          longitude: sample.lng ?? null,
        },
      });
      const row = await prisma.verificationCase.create({
        data: {
          code,
          customerId,
          propertyId: property.id,
          tierId: tierIds[sample.tier],
          status: sample.status,
          wizardStep: 6,
          submittedAt: new Date(),
          consentGrantedAt: new Date(),
          priceKobo: tier.priceKobo,
          turnaroundMinDays: tier.turnaroundMinDays,
          turnaroundMaxDays: tier.turnaroundMaxDays,
          contactName: "Mr. Olawale Johnson",
          contactPhone: "+2348020000010",
          contactEmail: "seller@example.com",
          contactRelationship: "SELLER",
          paidAt: paid ? new Date() : null,
          completedAt: sample.status === "COMPLETED" ? new Date() : null,
          documents: {
            create: {
              documentType: "CERTIFICATE_OF_OCCUPANCY",
              registrationNumber: `${sample.seq % 100}/${sample.seq % 50}/2011`,
              volume: "2011N",
              page: String(sample.seq % 90),
              nameOnDocument: "Olawale Johnson",
            },
          },
          events: {
            create: [
              { status: "PENDING_PAYMENT", title: "Request submitted", customerVisible: true, actorId: customerId },
              ...(paid ? [{ status: "PAID" as const, title: "Payment received", customerVisible: true }] : []),
              ...(sample.status === "IN_PROGRESS" || sample.status === "UNDER_REVIEW" || sample.status === "COMPLETED"
                ? [{ status: "IN_PROGRESS" as const, title: "Registry search started", customerVisible: true }]
                : []),
              ...(sample.status === "UNDER_REVIEW" || sample.status === "COMPLETED"
                ? [{ status: "UNDER_REVIEW" as const, title: "Findings sent to the lawyer", customerVisible: true }]
                : []),
              ...(sample.status === "COMPLETED" ? [{ status: "COMPLETED" as const, title: "Report issued", customerVisible: true }] : []),
            ],
          },
        },
      });
      if (paid) {
        await prisma.payment.create({
          data: {
            caseId: row.id,
            userId: customerId,
            paystackReference: `seed_${code}`,
            amountKobo: tier.priceKobo,
            status: "SUCCESS",
            channel: "card",
            paidAt: new Date(),
          },
        });
      }
    }
  }

  console.info("Seeded demo data: 6 users and 5 sample cases.");
}

function isLocalDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  try {
    return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function main() {
  const referenceOnly = process.argv.includes("--reference-only");
  if (!referenceOnly && !isLocalDatabase() && process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error(
      "Refusing to add demo accounts to a database that is not on this machine. " +
        "Use `npm run db:seed:prod` for real reference data only.",
    );
  }

  const reference = await seedReference();
  if (!referenceOnly) await seedDemo(reference);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
