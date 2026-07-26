import { describe, expect, it } from "vitest";
import { parseSocrataRows } from "./berkeley-socrata";
import { departmentEntityId, normalizeSocrataDepartments } from "./socrata-departments";
import { socrataDepartmentsFixture } from "./socrata-departments.fixtures";

const SOURCE_ID = "src-berkeley-socrata-gy8t-iqc4" as const;

function buildFromFixture() {
  const rows = parseSocrataRows(socrataDepartmentsFixture);
  return normalizeSocrataDepartments(rows, SOURCE_ID);
}

describe("normalizeSocrataDepartments", () => {
  it("sums every line item per (department, fiscalYear) into integer cents", () => {
    const { values } = buildFromFixture();
    const police2013 = values.find(
      (v) => v.entityId === "ent-socrata-dept-police" && v.fiscalYear === 2013,
    );
    const police2014 = values.find(
      (v) => v.entityId === "ent-socrata-dept-police" && v.fiscalYear === 2014,
    );
    // 6 line items of 100k+200k+300k+100k+100k+200k = 1,000,000 dollars.
    expect(police2013?.amountNominalCents).toBe(100_000_000);
    // FY2014: 1,100,000 dollars.
    expect(police2014?.amountNominalCents).toBe(110_000_000);
  });

  it("aggregates each included department and year pair exactly once", () => {
    const { values } = buildFromFixture();
    // 4 departments x 2 fiscal years = 8 values.
    expect(values).toHaveLength(8);
    const keys = new Set(values.map((v) => `${v.entityId}@${v.fiscalYear}`));
    expect(keys.size).toBe(8);
  });

  it("excludes departments with fewer than 10 total rows as noise", () => {
    const { values, entities } = buildFromFixture();
    // "Clerk Bureau" has 4 total rows (2 per year) and must be filtered out.
    expect(values.some((v) => v.entityId === "ent-socrata-dept-clerk-bureau")).toBe(false);
    expect(entities.some((e) => e.id === "ent-socrata-dept-clerk-bureau")).toBe(false);
  });

  it("registers one entity per surviving department with stable slugged ids", () => {
    const { entities } = buildFromFixture();
    expect(entities).toHaveLength(4);
    const ids = entities.map((e) => e.id);
    expect(ids).toContain("ent-socrata-dept-police");
    expect(ids).toContain("ent-socrata-dept-fire");
    expect(ids).toContain("ent-socrata-dept-public-works");
    expect(ids).toContain("ent-socrata-dept-parks");
    // Slug uniqueness: no two departments collapse to the same id.
    expect(new Set(ids).size).toBe(ids.length);
    // Every entity is typed as a department and carries a non-empty description.
    expect(entities.every((e) => e.type === "department")).toBe(true);
    expect(entities.every((e) => e.canonicalName.length > 0)).toBe(true);
    expect(entities.every((e) => e.plainDescription.length > 0)).toBe(true);
  });

  it("stamps every BudgetValue with adopted/budgetary/api/verified and the source id", () => {
    const { values } = buildFromFixture();
    expect(values.every((v) => v.stage === "adopted")).toBe(true);
    expect(values.every((v) => v.basis === "budgetary")).toBe(true);
    expect(values.every((v) => v.extractionMethod === "api")).toBe(true);
    expect(values.every((v) => v.confidence === "verified")).toBe(true);
    expect(values.every((v) => v.sourceId === SOURCE_ID)).toBe(true);
    expect(values.every((v) => v.entityType === "department")).toBe(true);
    expect(values.every((v) => v.schemaVersion === "1.0.0")).toBe(true);
  });

  it("labels each value with the department name and Socrata fiscal year", () => {
    const { values } = buildFromFixture();
    const fire2014 = values.find(
      (v) => v.entityId === "ent-socrata-dept-fire" && v.fiscalYear === 2014,
    );
    expect(fire2014?.sourceLabel).toBe("Berkeley Fire adopted budget (Socrata, FY2014)");
    // 6 x 90,000 = 540,000 dollars.
    expect(fire2014?.amountNominalCents).toBe(54_000_000);
  });

  it("emits values in deterministic (entityId, fiscalYear) order", () => {
    const { values } = buildFromFixture();
    const sequence = values.map((v) => `${v.entityId}@${v.fiscalYear}`).join("|");
    const sorted = [...values]
      .sort((a, b) =>
        a.entityId === b.entityId
          ? a.fiscalYear - b.fiscalYear
          : a.entityId.localeCompare(b.entityId),
      )
      .map((v) => `${v.entityId}@${v.fiscalYear}`)
      .join("|");
    expect(sequence).toBe(sorted);
  });

  it("returns empty artifacts for an empty cohort without throwing", () => {
    const { values, entities } = normalizeSocrataDepartments([], SOURCE_ID);
    expect(values).toHaveLength(0);
    expect(entities).toHaveLength(0);
  });

  it("departmentEntityId lowercases, hyphenates, and prefixes the department name", () => {
    expect(departmentEntityId("Public Works")).toBe("ent-socrata-dept-public-works");
    expect(departmentEntityId("Housing & Community Services")).toBe(
      "ent-socrata-dept-housing-community-services",
    );
  });
});
