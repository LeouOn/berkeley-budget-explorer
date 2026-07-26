import { describe, expect, it } from "vitest";
import {
  ACFR_GOVERNMENTAL_FUNDS_ENTITY_IDS,
  parseAcfrFy2025Snapshot,
  toAcfrGovernmentalFundsRecords,
} from "./acfr-transcription";

// SYNTHETIC fixture: values are illustrative cents, not the real snapshot bytes.
const validSnapshot = {
  schemaVersion: "1.0.0",
  reportType: "ACFR",
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

describe("ACFR FY2025 transcription adapter", () => {
  it("parses a valid snapshot", () => {
    expect(() => parseAcfrFy2025Snapshot(validSnapshot)).not.toThrow();
  });

  it("rejects an entity other than City of Berkeley", () => {
    const bad = { ...validSnapshot, entity: "Oakland" };
    expect(() => parseAcfrFy2025Snapshot(bad)).toThrow();
  });

  it("rejects a fiscal year other than 2025", () => {
    const bad = { ...validSnapshot, fiscalYear: 2024 };
    expect(() => parseAcfrFy2025Snapshot(bad)).toThrow();
  });

  it("rejects non-integer cent values", () => {
    const bad = {
      ...validSnapshot,
      fundGroups: {
        ...validSnapshot.fundGroups,
        generalFund: {
          ...validSnapshot.fundGroups.generalFund,
          totalRevenueCents: 100.5,
        },
      },
    };
    expect(() => parseAcfrFy2025Snapshot(bad)).toThrow();
  });

  it("emits six governmental-funds records covering the canonical entity ids", () => {
    const parsed = parseAcfrFy2025Snapshot(validSnapshot);
    const records = toAcfrGovernmentalFundsRecords(parsed);
    expect(records).toHaveLength(6);
    const ids = records.map((r) => r.entityId).sort();
    expect(ids).toEqual([...ACFR_GOVERNMENTAL_FUNDS_ENTITY_IDS].sort());
  });

  it("stamps each record with FY2025 and a descriptive source label", () => {
    const parsed = parseAcfrFy2025Snapshot(validSnapshot);
    const records = toAcfrGovernmentalFundsRecords(parsed);
    for (const r of records) {
      expect(r.fiscalYear).toBe(2025);
      expect(r.sourceLabel.startsWith("ACFR FY2025")).toBe(true);
      expect(r.sourceLabel.length).toBeGreaterThan(10);
    }
  });

  it("carries the all-governmental-funds total revenue into the right record", () => {
    const parsed = parseAcfrFy2025Snapshot(validSnapshot);
    const records = toAcfrGovernmentalFundsRecords(parsed);
    const totalRevenue = records.find((r) => r.entityId === "ent-acfr-gov-funds-total-revenue");
    expect(totalRevenue?.amountCents).toBe(200000);
  });

  it("carries the General Fund balance into the right record", () => {
    const parsed = parseAcfrFy2025Snapshot(validSnapshot);
    const records = toAcfrGovernmentalFundsRecords(parsed);
    const gfBalance = records.find((r) => r.entityId === "ent-acfr-general-fund-balance");
    expect(gfBalance?.amountCents).toBe(50000);
  });
});
