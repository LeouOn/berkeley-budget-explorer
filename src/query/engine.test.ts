import { describe, expect, it } from "vitest";
import type { BudgetValue, Entity } from "../pipeline/canonical/schema";
import type { OverviewSnapshot } from "../pipeline/derive/derive";
import { fiscalYearAverage } from "../pipeline/sources/bls-cpi";
import { parseCpiObservations } from "../pipeline/sources/bls-cpi-node";
import { blsFixture } from "../pipeline/sources/bls-cpi.fixtures";
import { formatCents, getOverviewTrend } from "./engine";

const entities: readonly Entity[] = [
  {
    id: "ent-citywide-berkeley",
    type: "service",
    canonicalName: "Citywide Berkeley Operations",
    plainDescription: "Citywide total.",
  },
];

const values: readonly BudgetValue[] = [
  {
    fiscalYear: 2020,
    amountNominalCents: 60000000000,
    stage: "actual",
    basis: "gaap",
    entityId: "ent-citywide-berkeley",
    entityType: "service",
    sourceId: "src-sco-expenditures-per-capita-ykhf-vfsr",
    sourceLabel: "Berkeley total expenditures (per-capita dataset, FY2020)",
    extractionMethod: "api",
    confidence: "verified",
    schemaVersion: "1.0.0",
  },
  {
    fiscalYear: 2024,
    amountNominalCents: 78000000000,
    stage: "actual",
    basis: "gaap",
    entityId: "ent-citywide-berkeley",
    entityType: "service",
    sourceId: "src-sco-expenditures-per-capita-ykhf-vfsr",
    sourceLabel: "Berkeley total expenditures (per-capita dataset, FY2024)",
    extractionMethod: "api",
    confidence: "verified",
    schemaVersion: "1.0.0",
  },
  {
    fiscalYear: 2024,
    amountNominalCents: 80000000000,
    stage: "actual",
    basis: "gaap",
    entityId: "ent-citywide-berkeley",
    entityType: "service",
    sourceId: "src-sco-revenues-per-capita-ky7j-fsk5",
    sourceLabel: "Berkeley total revenues (per-capita dataset, FY2024)",
    extractionMethod: "api",
    confidence: "verified",
    schemaVersion: "1.0.0",
  },
];

const snapshot: OverviewSnapshot = {
  fiscalYear: 2024,
  baseYear: 2024,
  mode: "real",
  surface: "sco-standardized-actuals",
  expendituresCents: 78000000000,
  revenuesCents: 80000000000,
  perResidentExpendituresCents: 627413,
  perResidentRevenuesCents: 643501,
  estimatedPopulation: 124320,
  comparability: "reconstructed",
  sources: ["src-sco-expenditures-per-capita-ykhf-vfsr", "src-sco-revenues-per-capita-ky7j-fsk5"],
  notes: [
    "Every Overview figure is a California State Controller standardized actual for Berkeley, not an adopted budget figure.",
  ],
};

const population = [
  { fiscalYear: 2020, estimatedPopulation: 121000 },
  { fiscalYear: 2024, estimatedPopulation: 124320 },
];

describe("query engine", () => {
  it("produces a trend sorted by fiscal year for the citywide entity", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const trend = getOverviewTrend({
      snapshot,
      values,
      entities,
      cpi: averages,
      population,
      mode: "nominal",
      baseYear: 2024,
    });
    expect(trend.map((p) => p.fiscalYear)).toEqual([2020, 2024]);
  });

  it("scales the historical year by the CPI factor in real-dollar mode", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const trend = getOverviewTrend({
      snapshot,
      values,
      entities,
      cpi: averages,
      population,
      mode: "real",
      baseYear: 2024,
    });
    const fy2020 = trend.find((p) => p.fiscalYear === 2020);
    expect(fy2020?.expendituresCents).toBeGreaterThan(60000000000);
  });

  it("formats cents as USD with comma separators", () => {
    expect(formatCents(78000000000)).toBe("$780,000,000.00");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(123)).toBe("$1.23");
  });
});
