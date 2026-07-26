import { describe, expect, it } from "vitest";
import type { BudgetValue, Entity } from "../canonical/schema";
import { fiscalYearAverage, parseCpiObservations } from "../sources/bls-cpi";
import { blsFixture } from "../sources/bls-cpi.fixtures";
import { buildOverviewSnapshot } from "./derive";

const entities: readonly Entity[] = [
  {
    id: "ent-citywide-berkeley",
    type: "service",
    canonicalName: "Citywide Berkeley Operations",
    plainDescription: "Citywide total reported by the State Controller.",
  },
];

const values: readonly BudgetValue[] = [
  {
    fiscalYear: 2024,
    amountNominalCents: 78000000000,
    stage: "actual",
    basis: "gaap",
    entityId: "ent-citywide-berkeley",
    entityType: "service",
    sourceId: "src-sco-expenditures-per-capita-ykhf-vfsr",
    sourceLabel: "City of Berkeley total expenditures (per-capita dataset, FY2024)",
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
    sourceLabel: "City of Berkeley total revenues (per-capita dataset, FY2024)",
    extractionMethod: "api",
    confidence: "verified",
    schemaVersion: "1.0.0",
  },
  {
    fiscalYear: 2020,
    amountNominalCents: 60000000000,
    stage: "actual",
    basis: "gaap",
    entityId: "ent-citywide-berkeley",
    entityType: "service",
    sourceId: "src-sco-expenditures-per-capita-ykhf-vfsr",
    sourceLabel: "City of Berkeley total expenditures (per-capita dataset, FY2020)",
    extractionMethod: "api",
    confidence: "verified",
    schemaVersion: "1.0.0",
  },
  {
    fiscalYear: 2020,
    amountNominalCents: 61000000000,
    stage: "actual",
    basis: "gaap",
    entityId: "ent-citywide-berkeley",
    entityType: "service",
    sourceId: "src-sco-revenues-per-capita-ky7j-fsk5",
    sourceLabel: "City of Berkeley total revenues (per-capita dataset, FY2020)",
    extractionMethod: "api",
    confidence: "verified",
    schemaVersion: "1.0.0",
  },
];

const population = [
  { fiscalYear: 2020, estimatedPopulation: 121000 },
  { fiscalYear: 2024, estimatedPopulation: 124320 },
];

describe("derive", () => {
  it("builds an Overview snapshot with nominal dollars for the requested year", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const snapshot = buildOverviewSnapshot({
      values,
      entities,
      cpi: averages,
      population,
      targetFiscalYear: 2024,
      mode: "nominal",
      baseYear: 2024,
    });
    expect(snapshot.fiscalYear).toBe(2024);
    expect(snapshot.expendituresCents).toBe(78000000000);
    expect(snapshot.perResidentExpendituresCents).toBe(Math.round(78000000000 / 124320));
    expect(snapshot.surface).toBe("sco-standardized-actuals");
    expect(snapshot.notes[0]).toMatch(/standardized actual/i);
  });

  it("reports reconstructed comparability in nominal mode", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const snapshot = buildOverviewSnapshot({
      values,
      entities,
      cpi: averages,
      population,
      targetFiscalYear: 2024,
      mode: "nominal",
      baseYear: 2024,
    });
    expect(snapshot.comparability).toBe("reconstructed");
  });

  it("reports reconstructed comparability in real mode (mode does not overwrite comparability)", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const snapshot = buildOverviewSnapshot({
      values,
      entities,
      cpi: averages,
      population,
      targetFiscalYear: 2024,
      mode: "real",
      baseYear: 2024,
    });
    expect(snapshot.comparability).toBe("reconstructed");
  });

  it("scales the real-dollar total by the CPI factor between the year and base year", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const snapshot = buildOverviewSnapshot({
      values,
      entities,
      cpi: averages,
      population,
      targetFiscalYear: 2020,
      mode: "real",
      baseYear: 2024,
    });
    expect(snapshot.fiscalYear).toBe(2020);
    expect(snapshot.expendituresCents).not.toBe(60000000000);
    expect(snapshot.expendituresCents).toBeGreaterThan(60000000000);
  });
});
