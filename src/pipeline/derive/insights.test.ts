import { describe, expect, it } from "vitest";
import type { BudgetValue, Entity } from "../canonical/schema";
import { fiscalYearAverage, parseCpiObservations } from "../sources/bls-cpi";
import { blsFixture } from "../sources/bls-cpi.fixtures";
import { buildOverviewInsights } from "./insights";

const entities: readonly Entity[] = [
  {
    id: "ent-sco-cat-public-safety",
    type: "expense-category",
    canonicalName: "Public Safety",
    plainDescription: "Public safety spending.",
  },
  {
    id: "ent-sco-cat-health",
    type: "expense-category",
    canonicalName: "Health",
    plainDescription: "Health spending.",
  },
  {
    id: "ent-budget-fy2025-general-fund-expenditure",
    type: "service",
    canonicalName: "FY2025 Adopted Budget: General Fund Expenditure",
    plainDescription: "Adopted FY2025 General Fund expenditure.",
  },
  {
    id: "ent-acfr-general-fund-expenditure",
    type: "fund",
    canonicalName: "ACFR FY2025 General Fund Expenditure",
    plainDescription: "Actual FY2025 General Fund expenditure.",
  },
];

function cat(entityId: string, fiscalYear: number, amountNominalCents: number): BudgetValue {
  return {
    fiscalYear,
    amountNominalCents,
    stage: "actual",
    basis: "gaap",
    entityId,
    entityType: "expense-category",
    sourceId: "src-sco-expenditures-ju3w-4gxp",
    sourceLabel: "Berkeley (SCO detailed)",
    extractionMethod: "api",
    confidence: "verified",
    schemaVersion: "1.0.0",
  };
}

const pre2017OnlyValues: readonly BudgetValue[] = [
  cat("ent-sco-cat-public-safety", 2005, 5_000_000_000),
  cat("ent-sco-cat-public-safety", 2016, 8_000_000_000),
  cat("ent-sco-cat-health", 2006, 2_000_000_000),
  cat("ent-sco-cat-health", 2016, 4_000_000_000),
];

const blsCoveredGrowthValues: readonly BudgetValue[] = [
  cat("ent-sco-cat-growth-winner", 2019, 1_000_000_000),
  cat("ent-sco-cat-growth-winner", 2024, 5_000_000_000),
  cat("ent-sco-cat-growth-loser", 2019, 4_000_000_000),
  cat("ent-sco-cat-growth-loser", 2024, 4_200_000_000),
  cat("ent-sco-cat-post-only", 2019, 1_000_000_000),
  cat("ent-sco-cat-post-only", 2024, 1_500_000_000),
];

const values: readonly BudgetValue[] = [...pre2017OnlyValues, ...blsCoveredGrowthValues];

describe("buildOverviewInsights", () => {
  it("always emits a schema-reorganization insight when both pre- and post-break categories exist", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const insights = buildOverviewInsights({
      values,
      entities,
      cpi: averages,
      baseYear: 2024,
    });
    const schema = insights.find((i) => i.id === "schema-reorganization");
    expect(schema).toBeDefined();
    expect(schema?.body).toMatch(/categories before FY2017 became/);
    expect(schema?.body).toMatch(/post-FY2017/);
  });

  it("emits a largest-real-growth insight with a compare deep link", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const insights = buildOverviewInsights({
      values,
      entities,
      cpi: averages,
      baseYear: 2024,
    });
    const growth = insights.find((i) => i.id === "largest-real-growth");
    expect(growth).toBeDefined();
    expect(growth?.linkToCompare?.length).toBe(1);
    expect(growth?.body).toMatch(/%/);
  });

  it("picks the category with the highest real-dollar percent change", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const insights = buildOverviewInsights({
      values,
      entities,
      cpi: averages,
      baseYear: 2024,
    });
    const growth = insights.find((i) => i.id === "largest-real-growth");
    expect(growth?.linkToCompare?.[0]).toBe("ent-sco-cat-growth-winner");
  });

  it("omits largest-real-growth when no category clears the minimum span", () => {
    const shortSpanValues: readonly BudgetValue[] = [
      cat("ent-sco-cat-public-safety", 2020, 1_000_000_000),
      cat("ent-sco-cat-public-safety", 2022, 1_100_000_000),
    ];
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const insights = buildOverviewInsights({
      values: shortSpanValues,
      entities,
      cpi: averages,
      baseYear: 2024,
    });
    expect(insights.find((i) => i.id === "largest-real-growth")).toBeUndefined();
  });

  it("emits adopted-vs-actual insight when both adopted and actual FY2025 General Fund values exist", () => {
    const withAdopted: readonly BudgetValue[] = [
      ...values,
      {
        fiscalYear: 2025,
        amountNominalCents: 2_574_932_400,
        stage: "adopted",
        basis: "budgetary",
        entityId: "ent-budget-fy2025-general-fund-expenditure",
        entityType: "service",
        sourceId: "src-budget-fy2025",
        sourceLabel: "Adopted GF expenditure",
        extractionMethod: "manual-transcription",
        confidence: "verified",
        schemaVersion: "1.0.0",
      },
      {
        fiscalYear: 2025,
        amountNominalCents: 2_769_419_240,
        stage: "actual",
        basis: "modified-accrual",
        entityId: "ent-acfr-general-fund-expenditure",
        entityType: "fund",
        sourceId: "src-acfr-fy2025",
        sourceLabel: "Actual GF expenditure",
        extractionMethod: "manual-transcription",
        confidence: "verified",
        schemaVersion: "1.0.0",
      },
    ];
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const insights = buildOverviewInsights({
      values: withAdopted,
      entities,
      cpi: averages,
      baseYear: 2024,
    });
    const variance = insights.find((i) => i.id === "general-fund-adopted-vs-actual");
    expect(variance).toBeDefined();
    expect(variance?.body).toMatch(/more than adopted/);
    expect(variance?.linkToCompare).toHaveLength(2);
  });

  it("omits adopted-vs-actual insight when either adopted or actual is missing", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const insights = buildOverviewInsights({
      values,
      entities,
      cpi: averages,
      baseYear: 2024,
    });
    expect(insights.find((i) => i.id === "general-fund-adopted-vs-actual")).toBeUndefined();
  });

  it("schema-reorganization counts distinct pre- and new-post-break entities", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const insights = buildOverviewInsights({
      values,
      entities,
      cpi: averages,
      baseYear: 2024,
    });
    const schema = insights.find((i) => i.id === "schema-reorganization");
    expect(schema?.body).toMatch(/2 expenditure categories before FY2017 became 3 new categories/);
  });
});
