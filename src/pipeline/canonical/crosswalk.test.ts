import { describe, expect, it } from "vitest";
import { loadCrosswalk, resolveEntityId, validateCrosswalk } from "./crosswalk";
import crosswalkData from "./crosswalk.data.json" with { type: "json" };
import type { Entity } from "./schema";

const entities: readonly Entity[] = [
  {
    id: "ent-service-streets",
    type: "service",
    canonicalName: "Streets and Sidewalks",
    plainDescription: "Roadway maintenance and paving.",
    serviceKey: "svc-streets",
  },
  {
    id: "ent-department-public-works",
    type: "department",
    canonicalName: "Public Works",
    plainDescription: "Public works operations.",
  },
  {
    id: "ent-citywide-berkeley",
    type: "service",
    canonicalName: "Citywide Berkeley Operations",
    plainDescription: "Citywide total reported by the State Controller.",
  },
  {
    id: "ent-sco-cat-general-government-and-public-safety",
    type: "expense-category",
    canonicalName: "General Government and Public Safety",
    plainDescription: "Post-2017 merged category.",
  },
  {
    id: "ent-sco-cat-transportation-and-community-development",
    type: "expense-category",
    canonicalName: "Transportation and Community Development",
    plainDescription: "Post-2017 merged category.",
  },
  {
    id: "ent-sco-cat-health-and-culture-and-leisure",
    type: "expense-category",
    canonicalName: "Health and Culture and Leisure",
    plainDescription: "Post-2017 merged category.",
  },
  {
    id: "ent-sco-cat-public-utilities-and-other-expenditures",
    type: "expense-category",
    canonicalName: "Public Utilities and Other Expenditures",
    plainDescription: "Post-2017 merged category.",
  },
];

describe("crosswalk loader", () => {
  it("loads the pinned fixture", () => {
    const entries = loadCrosswalk(crosswalkData);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("resolves a fiscal year to the matching canonical entity id", () => {
    const entries = loadCrosswalk(crosswalkData);
    const id = resolveEntityId(entries, "socrata:department:Public Works", 2014);
    expect(id).toBe("ent-department-public-works");
  });

  it("returns undefined when no entry covers the fiscal year", () => {
    const entries = loadCrosswalk(crosswalkData);
    const id = resolveEntityId(entries, "socrata:department:Public Works", 2020);
    expect(id).toBeUndefined();
  });

  it("validates that canonical entity ids exist in the registry", () => {
    const entries = loadCrosswalk(crosswalkData);
    const result = validateCrosswalk(entries, entities);
    expect(result.ok).toBe(true);
  });

  it("flags a missing canonical entity", () => {
    const entries = loadCrosswalk(crosswalkData);
    const orphan: readonly Entity[] = [];
    const result = validateCrosswalk(entries, orphan);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("flags overlapping effective ranges for the same source entity key", () => {
    const overlapping = [
      {
        sourceEntityKey: "socrata:department:Public Works",
        canonicalEntityId: "ent-department-public-works",
        effectiveStart: 2012,
        effectiveEnd: 2016,
        rationale: "First window",
        cardinality: "one-to-one" as const,
        comparability: "exact" as const,
        reviewer: "pipeline-bot",
        reviewedAt: "2026-07-20",
      },
      {
        sourceEntityKey: "socrata:department:Public Works",
        canonicalEntityId: "ent-department-public-works",
        effectiveStart: 2014,
        effectiveEnd: 2018,
        rationale: "Overlaps prior window",
        cardinality: "one-to-one" as const,
        comparability: "exact" as const,
        reviewer: "pipeline-bot",
        reviewedAt: "2026-07-20",
      },
    ];
    const result = validateCrosswalk(overlapping, entities);
    expect(result.ok).toBe(false);
  });

  it("maps pre-2017 Public Safety to the merged General Government and Public Safety category", () => {
    const entries = loadCrosswalk(crosswalkData);
    const id = resolveEntityId(entries, "sco-detailed:category:Public Safety", 2010);
    expect(id).toBe("ent-sco-cat-general-government-and-public-safety");
  });

  it("maps pre-2017 General Government to the merged General Government and Public Safety category", () => {
    const entries = loadCrosswalk(crosswalkData);
    const id = resolveEntityId(entries, "sco-detailed:category:General Government", 2010);
    expect(id).toBe("ent-sco-cat-general-government-and-public-safety");
  });

  it("maps pre-2017 Community Development to Transportation and Community Development", () => {
    const entries = loadCrosswalk(crosswalkData);
    const id = resolveEntityId(entries, "sco-detailed:category:Community Development", 2010);
    expect(id).toBe("ent-sco-cat-transportation-and-community-development");
  });

  it("maps pre-2017 Transportation to Transportation and Community Development", () => {
    const entries = loadCrosswalk(crosswalkData);
    const id = resolveEntityId(entries, "sco-detailed:category:Transportation", 2010);
    expect(id).toBe("ent-sco-cat-transportation-and-community-development");
  });

  it("maps pre-2017 Health to Health and Culture and Leisure", () => {
    const entries = loadCrosswalk(crosswalkData);
    const id = resolveEntityId(entries, "sco-detailed:category:Health", 2010);
    expect(id).toBe("ent-sco-cat-health-and-culture-and-leisure");
  });

  it("maps pre-2017 Culture and Leisure to Health and Culture and Leisure", () => {
    const entries = loadCrosswalk(crosswalkData);
    const id = resolveEntityId(entries, "sco-detailed:category:Culture and Leisure", 2010);
    expect(id).toBe("ent-sco-cat-health-and-culture-and-leisure");
  });

  it("maps pre-2017 Public Utilities to Public Utilities and Other Expenditures", () => {
    const entries = loadCrosswalk(crosswalkData);
    const id = resolveEntityId(entries, "sco-detailed:category:Public Utilities", 2010);
    expect(id).toBe("ent-sco-cat-public-utilities-and-other-expenditures");
  });

  it("maps pre-2017 Other Expenditures to Public Utilities and Other Expenditures", () => {
    const entries = loadCrosswalk(crosswalkData);
    const id = resolveEntityId(entries, "sco-detailed:category:Other Expenditures", 2010);
    expect(id).toBe("ent-sco-cat-public-utilities-and-other-expenditures");
  });

  it("pre-2017 category mappings expire at FY2016 (before the FY2017 schema break)", () => {
    const entries = loadCrosswalk(crosswalkData);
    const afterBreak = resolveEntityId(entries, "sco-detailed:category:Public Safety", 2017);
    expect(afterBreak).toBeUndefined();
  });

  it("maps ACFR governmental-funds total revenue to citywide Berkeley approximately", () => {
    const entries = loadCrosswalk(crosswalkData);
    const id = resolveEntityId(entries, "acfr:entity:ent-acfr-gov-funds-total-revenue", 2025);
    expect(id).toBe("ent-citywide-berkeley");
  });

  it("maps ACFR governmental-funds total expenditure to citywide Berkeley approximately", () => {
    const entries = loadCrosswalk(crosswalkData);
    const id = resolveEntityId(entries, "acfr:entity:ent-acfr-gov-funds-total-expenditure", 2025);
    expect(id).toBe("ent-citywide-berkeley");
  });

  it("maps ACFR General Fund revenue to citywide Berkeley as incompatible", () => {
    const entries = loadCrosswalk(crosswalkData);
    const entry = entries.find(
      (e) => e.sourceEntityKey === "acfr:entity:ent-acfr-general-fund-revenue",
    );
    expect(entry?.canonicalEntityId).toBe("ent-citywide-berkeley");
    expect(entry?.comparability).toBe("incompatible");
  });

  it("the expanded pinned crosswalk still validates against the entity registry", () => {
    const entries = loadCrosswalk(crosswalkData);
    const result = validateCrosswalk(entries, entities);
    expect(result.ok).toBe(true);
  });

  it("the expanded pinned crosswalk has more than the original three entries", () => {
    const entries = loadCrosswalk(crosswalkData);
    expect(entries.length).toBeGreaterThan(3);
  });
});
