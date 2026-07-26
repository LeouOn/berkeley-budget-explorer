export interface ServiceEntry {
  readonly serviceKey: string;
  readonly label: string;
  readonly plainDescription: string;
  readonly socrataProgramKey: string | null;
  // Maps this service to the Socrata department slug (the hyphenated tail of an
  // `ent-socrata-dept-<slug>` entity id) when a single primary department covers
  // the service. Null means no clean one-to-one Socrata department exists.
  readonly socrataDepartmentKey: string | null;
}

export const serviceTaxonomy: readonly ServiceEntry[] = [
  {
    serviceKey: "svc-public-safety",
    label: "Public safety",
    plainDescription: "Police, fire, and emergency response.",
    socrataProgramKey: null,
    socrataDepartmentKey: "police",
  },
  {
    serviceKey: "svc-streets",
    label: "Streets and sidewalks",
    plainDescription: "Roadway maintenance and paving programs.",
    socrataProgramKey: "Streets and Sidewalks",
    socrataDepartmentKey: "public-works",
  },
  {
    serviceKey: "svc-housing",
    label: "Housing and homelessness",
    plainDescription: "Affordable housing and shelter programs.",
    socrataProgramKey: null,
    socrataDepartmentKey: "housing-community-services",
  },
  {
    serviceKey: "svc-parks",
    label: "Parks and recreation",
    plainDescription: "Parks, pools, and recreation centers.",
    socrataProgramKey: null,
    socrataDepartmentKey: "parks",
  },
  {
    serviceKey: "svc-libraries",
    label: "Libraries",
    plainDescription: "Branch operations, materials, and programs.",
    socrataProgramKey: "Public Services",
    socrataDepartmentKey: "central-library",
  },
  {
    serviceKey: "svc-health",
    label: "Health and human services",
    plainDescription: "Public health, mental health, and aging services.",
    socrataProgramKey: null,
    socrataDepartmentKey: "public-health",
  },
  {
    serviceKey: "svc-climate",
    label: "Climate and environment",
    plainDescription: "Sustainability, energy, and resilience programs.",
    socrataProgramKey: null,
    socrataDepartmentKey: null,
  },
  {
    serviceKey: "svc-economic",
    label: "Economic development",
    plainDescription: "Workforce, small business, and arts programs.",
    socrataProgramKey: null,
    socrataDepartmentKey: "economic-development",
  },
  {
    serviceKey: "svc-general",
    label: "General government",
    plainDescription: "City Council, City Manager, Attorney, Auditor.",
    socrataProgramKey: null,
    socrataDepartmentKey: "city-manager",
  },
];

// Returns the Socrata department slug for a service key, or null if the service
// has no single mapped department. The slug is the tail of the entity id, so a
// return value of "police" corresponds to `ent-socrata-dept-police`.
export function getSocrataDepartmentKeyForService(serviceKey: string): string | null {
  return serviceTaxonomy.find((s) => s.serviceKey === serviceKey)?.socrataDepartmentKey ?? null;
}
