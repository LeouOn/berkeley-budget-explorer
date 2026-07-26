import { describe, expect, it } from "vitest";
import {
  parseAcfrFy2025Snapshot,
  toAcfrGovernmentalFundsRecords,
} from "../sources/acfr-transcription";
import { parseSocrataRows } from "../sources/berkeley-socrata";
import { socrataFixture } from "../sources/berkeley-socrata.fixtures";
import {
  filterBerkeley,
  parseScoExpenditurePerCapita,
  parseScoRevenuePerCapita,
} from "../sources/sco-per-capita";
import {
  scoExpenditurePerCapitaFixture,
  scoRevenuePerCapitaFixture,
} from "../sources/sco-per-capita.fixtures";
import {
  buildAcfrEntities,
  buildCitywideEntities,
  normalizeAcfrGovernmentalFunds,
  normalizeScoExpenditurePerCapita,
  normalizeScoRevenuePerCapita,
  normalizeSocrata,
} from "./normalize";

const acfrFixture = {
  schemaVersion: "1.0.0",
  reportType: "ACFR" as const,
  entity: "City of Berkeley",
  fiscalYear: 2025,
  fiscalYearEnd: "2025-06-30",
  sourcePages: { balanceSheet: 75, govFundsStatement: 77, reconciliation: 76 },
  fundGroups: {
    generalFund: {
      totalRevenueCents: 100000,
      totalExpenditureCents: 80000,
      endingFundBalanceCents: 50000,
    },
    allGovernmentalFunds: {
      totalRevenueCents: 200000,
      totalExpenditureCents: 180000,
      endingFundBalanceCents: 120000,
      netChangeInFundBalanceCents: 20000,
    },
    breakdown: {
      generalFund: { revenue: 100000, expenditure: 80000, fundBalance: 50000 },
      capitalProjectsFund: { revenue: 40000, expenditure: 30000, fundBalance: 20000 },
      measureOGrrants: { revenue: 10000, expenditure: 9000, fundBalance: 5000 },
      housing: { revenue: 1000, expenditure: 900, fundBalance: 800 },
      libraryImprovementBond: { revenue: 500, expenditure: 0, fundBalance: 3000 },
      otherGovFunds: { revenue: 48500, expenditure: 60100, fundBalance: 41200 },
    },
  },
  expenditureByFunction: {
    generalGovernment: 1000,
    publicSafety: 2000,
    highwayAndStreets: 300,
    healthAndWelfare: 400,
    cultureRecreation: 500,
    communityDevelopmentAndHousing: 600,
    economicDevelopment: 100,
    debtServicePrincipal: 200,
    debtServiceInterest: 50,
    capitalOutlay: 700,
  },
};

describe("normalize", () => {
  it("emits a verified BudgetValue per Socrata line item, stamped with the source id", () => {
    const rows = parseSocrataRows(socrataFixture);
    const values = normalizeSocrata(rows, "src-berkeley-socrata-gy8t-iqc4");
    expect(values.length).toBe(rows.length);
    expect(values[0]?.sourceId).toBe("src-berkeley-socrata-gy8t-iqc4");
    expect(values[0]?.stage).toBe("adopted");
    expect(values[0]?.basis).toBe("budgetary");
    expect(values[0]?.confidence).toBe("verified");
    expect(values[0]?.extractionMethod).toBe("api");
  });

  it("emits a verified BudgetValue per SCO per-capita expenditure row for Berkeley with gaap basis", () => {
    const rows = filterBerkeley(parseScoExpenditurePerCapita(scoExpenditurePerCapitaFixture));
    const values = normalizeScoExpenditurePerCapita(
      rows,
      "src-sco-expenditures-per-capita-ykhf-vfsr",
    );
    expect(values.length).toBe(rows.length);
    expect(values.every((v) => v.basis === "gaap")).toBe(true);
    expect(values.every((v) => v.stage === "actual")).toBe(true);
    expect(values.every((v) => v.confidence === "verified")).toBe(true);
    expect(values.every((v) => v.sourceId === "src-sco-expenditures-per-capita-ykhf-vfsr")).toBe(
      true,
    );
    expect(values.every((v) => v.entityId === "ent-citywide-expenditure")).toBe(true);
    expect(values.every((v) => v.entityType === "expense-category")).toBe(true);
  });

  it("emits a verified BudgetValue per SCO per-capita revenue row for Berkeley with gaap basis", () => {
    const rows = filterBerkeley(parseScoRevenuePerCapita(scoRevenuePerCapitaFixture));
    const values = normalizeScoRevenuePerCapita(rows, "src-sco-revenues-per-capita-ky7j-fsk5");
    expect(values.length).toBe(rows.length);
    expect(values.every((v) => v.basis === "gaap")).toBe(true);
    expect(values.every((v) => v.stage === "actual")).toBe(true);
    expect(values.every((v) => v.sourceId === "src-sco-revenues-per-capita-ky7j-fsk5")).toBe(true);
    expect(values.every((v) => v.entityId === "ent-citywide-revenue")).toBe(true);
    expect(values.every((v) => v.entityType === "revenue-category")).toBe(true);
  });

  it("uses the crosswalk canonical entity id when one applies", () => {
    const rows = parseSocrataRows(socrataFixture.filter((r) => r.department === "Public Works"));
    const values = normalizeSocrata(rows, "src-berkeley-socrata-gy8t-iqc4");
    expect(values.every((v) => v.entityId.startsWith("ent-"))).toBe(true);
  });

  it("emits a verified BudgetValue per ACFR governmental-funds record with modified-accrual basis", () => {
    const parsed = parseAcfrFy2025Snapshot(acfrFixture);
    const records = toAcfrGovernmentalFundsRecords(parsed);
    const values = normalizeAcfrGovernmentalFunds(records, "src-acfr-fy2025");
    expect(values).toHaveLength(6);
    expect(values.every((v) => v.stage === "actual")).toBe(true);
    expect(values.every((v) => v.basis === "modified-accrual")).toBe(true);
    expect(values.every((v) => v.extractionMethod === "manual-transcription")).toBe(true);
    expect(values.every((v) => v.confidence === "verified")).toBe(true);
    expect(values.every((v) => v.sourceId === "src-acfr-fy2025")).toBe(true);
    expect(values.every((v) => v.fiscalYear === 2025)).toBe(true);
  });

  it("preserves the source label and amount from each ACFR record", () => {
    const parsed = parseAcfrFy2025Snapshot(acfrFixture);
    const records = toAcfrGovernmentalFundsRecords(parsed);
    const values = normalizeAcfrGovernmentalFunds(records, "src-acfr-fy2025");
    const totalRevenue = values.find((v) => v.entityId === "ent-acfr-gov-funds-total-revenue");
    expect(totalRevenue?.amountNominalCents).toBe(200000);
    expect(totalRevenue?.sourceLabel).toBe("ACFR FY2025 total governmental funds revenue");
  });

  it("buildAcfrEntities returns six fund entities with stable ids", () => {
    const entities = buildAcfrEntities();
    expect(entities).toHaveLength(6);
    expect(entities.every((e) => e.type === "fund")).toBe(true);
    const ids = entities.map((e) => e.id).sort();
    expect(ids).toContain("ent-acfr-gov-funds-total-revenue");
    expect(ids).toContain("ent-acfr-general-fund-balance");
  });

  it("buildCitywideEntities returns umbrella plus expense and revenue citywide entities", () => {
    const entities = buildCitywideEntities();
    const ids = entities.map((e) => e.id);
    expect(ids).toContain("ent-citywide-berkeley");
    expect(ids).toContain("ent-citywide-expenditure");
    expect(ids).toContain("ent-citywide-revenue");
    const expenditure = entities.find((e) => e.id === "ent-citywide-expenditure");
    expect(expenditure?.type).toBe("expense-category");
    const revenue = entities.find((e) => e.id === "ent-citywide-revenue");
    expect(revenue?.type).toBe("revenue-category");
  });
});
