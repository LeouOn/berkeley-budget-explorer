export interface ServiceEntry {
  readonly serviceKey: string;
  readonly label: string;
  readonly plainDescription: string;
  readonly socrataProgramKey: string | null;
  // Maps this service to the Socrata department slug (the hyphenated tail of an
  // `ent-socrata-dept-<slug>` entity id) when a single primary department covers
  // the service. Null means no clean one-to-one Socrata department exists.
  readonly socrataDepartmentKey: string | null;
  // SCO detailed expenditure-category entities (`ent-sco-cat-*`) that are the
  // closest fit for this service. These are approximate mappings — SCO
  // categories do not line up 1:1 with resident-facing services, and pre-2017
  // combined categories are listed alongside post-2017 ones so the FY2017
  // schema break stays visible. Empty array means no clean category mapping.
  readonly relatedExpenseCategoryIds: readonly string[];
}

export const serviceTaxonomy: readonly ServiceEntry[] = [
  {
    serviceKey: "svc-public-safety",
    label: "Public safety",
    plainDescription: "Police, fire, and emergency response.",
    socrataProgramKey: null,
    socrataDepartmentKey: "police",
    relatedExpenseCategoryIds: [
      "ent-sco-cat-public-safety",
      "ent-sco-cat-general-government-and-public-safety",
    ],
  },
  {
    serviceKey: "svc-streets",
    label: "Streets and sidewalks",
    plainDescription: "Roadway maintenance and paving programs.",
    socrataProgramKey: "Streets and Sidewalks",
    socrataDepartmentKey: "public-works",
    relatedExpenseCategoryIds: [
      "ent-sco-cat-transportation",
      "ent-sco-cat-transportation-and-community-development",
    ],
  },
  {
    serviceKey: "svc-housing",
    label: "Housing and homelessness",
    plainDescription: "Affordable housing and shelter programs.",
    socrataProgramKey: null,
    socrataDepartmentKey: "housing-community-services",
    relatedExpenseCategoryIds: [
      "ent-sco-cat-community-development",
      "ent-sco-cat-transportation-and-community-development",
    ],
  },
  {
    serviceKey: "svc-parks",
    label: "Parks and recreation",
    plainDescription: "Parks, pools, and recreation centers.",
    socrataProgramKey: null,
    socrataDepartmentKey: "parks",
    relatedExpenseCategoryIds: [
      "ent-sco-cat-culture-and-leisure",
      "ent-sco-cat-health-and-culture-and-leisure",
    ],
  },
  {
    serviceKey: "svc-libraries",
    label: "Libraries",
    plainDescription: "Branch operations, materials, and programs.",
    socrataProgramKey: "Public Services",
    socrataDepartmentKey: "central-library",
    relatedExpenseCategoryIds: [
      "ent-sco-cat-culture-and-leisure",
      "ent-sco-cat-health-and-culture-and-leisure",
    ],
  },
  {
    serviceKey: "svc-health",
    label: "Health and human services",
    plainDescription: "Public health, mental health, and aging services.",
    socrataProgramKey: null,
    socrataDepartmentKey: "public-health",
    relatedExpenseCategoryIds: ["ent-sco-cat-health", "ent-sco-cat-health-and-culture-and-leisure"],
  },
  {
    serviceKey: "svc-climate",
    label: "Climate and environment",
    plainDescription: "Sustainability, energy, and resilience programs.",
    socrataProgramKey: null,
    socrataDepartmentKey: null,
    relatedExpenseCategoryIds: [],
  },
  {
    serviceKey: "svc-economic",
    label: "Economic development",
    plainDescription: "Workforce, small business, and arts programs.",
    socrataProgramKey: null,
    socrataDepartmentKey: "economic-development",
    relatedExpenseCategoryIds: [
      "ent-sco-cat-community-development",
      "ent-sco-cat-transportation-and-community-development",
    ],
  },
  {
    serviceKey: "svc-general",
    label: "General government",
    plainDescription: "City Council, City Manager, Attorney, Auditor.",
    socrataProgramKey: null,
    socrataDepartmentKey: "city-manager",
    relatedExpenseCategoryIds: [
      "ent-sco-cat-general-government",
      "ent-sco-cat-general-government-and-public-safety",
    ],
  },
];

// Returns the Socrata department slug for a service key, or null if the service
// has no single mapped department. The slug is the tail of the entity id, so a
// return value of "police" corresponds to `ent-socrata-dept-police`.
export function getSocrataDepartmentKeyForService(serviceKey: string): string | null {
  return serviceTaxonomy.find((s) => s.serviceKey === serviceKey)?.socrataDepartmentKey ?? null;
}

export function getServiceByKey(serviceKey: string): ServiceEntry | null {
  return serviceTaxonomy.find((s) => s.serviceKey === serviceKey) ?? null;
}

export function isServiceKey(value: string): boolean {
  return serviceTaxonomy.some((s) => s.serviceKey === value);
}
