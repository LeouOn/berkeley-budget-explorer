import { describe, expect, it } from "vitest";
import {
  BUDGET_FY2025_ENTITY_IDS,
  parseBudgetFy2025Snapshot,
  toBudgetAdoptedRecords,
} from "./budget-transcription";

// SYNTHETIC fixture: cents values are illustrative, not the real snapshot bytes.
const validSnapshot = {
  schemaVersion: "1.0.0",
  reportType: "Adopted Budget",
  entity: "City of Berkeley",
  fiscalYear: 2025,
  sourceDocument: "FY 2025-2026 Adopted Biennial Budget",
  sourceUrl:
    "https://berkeleyca.gov/sites/default/files/documents/FY-2025-2026-Proposed-Biennial-Budget.pdf",
  extractedPages: {
    budgetMessage: 10,
    operatingOverview: 39,
    expenditureHistory: 41,
    expenditureByFund: 44,
  },
  allFunds: {
    totalRevenueCents: 67500000000,
    totalExpenditureCents: 74667136400,
  },
  generalFund: {
    revenueCents: 26922217700,
    expenditureCents: 25749324000,
    transfersInCents: 1095577700,
    transfersOutCents: 3494948000,
    resultsFromOperationsCents: -1226476600,
  },
  expenditureByCategory: {
    salariesAndBenefits: 38032907400,
    servicesAndMaterials: 15120843000,
    capitalOutlay: 7235634000,
    internalServicesAndAllOther: 14277752000,
  },
};

describe("FY2025 adopted budget transcription adapter", () => {
  it("parses a valid snapshot", () => {
    expect(() => parseBudgetFy2025Snapshot(validSnapshot)).not.toThrow();
  });

  it("rejects an entity other than City of Berkeley", () => {
    const bad = { ...validSnapshot, entity: "Oakland" };
    expect(() => parseBudgetFy2025Snapshot(bad)).toThrow();
  });

  it("rejects a fiscal year other than 2025", () => {
    const bad = { ...validSnapshot, fiscalYear: 2024 };
    expect(() => parseBudgetFy2025Snapshot(bad)).toThrow();
  });

  it("rejects a reportType other than Adopted Budget", () => {
    const bad = { ...validSnapshot, reportType: "ACFR" };
    expect(() => parseBudgetFy2025Snapshot(bad)).toThrow();
  });

  it("rejects non-integer cent values", () => {
    const bad = {
      ...validSnapshot,
      allFunds: {
        ...validSnapshot.allFunds,
        totalRevenueCents: 67500000000.5,
      },
    };
    expect(() => parseBudgetFy2025Snapshot(bad)).toThrow();
  });

  it("emits four adopted-budget records covering the canonical entity ids", () => {
    const parsed = parseBudgetFy2025Snapshot(validSnapshot);
    const records = toBudgetAdoptedRecords(parsed);
    expect(records).toHaveLength(4);
    const ids = records.map((r) => r.entityId).sort();
    expect(ids).toEqual([...BUDGET_FY2025_ENTITY_IDS].sort());
  });

  it("stamps each record with FY2025 and a descriptive source label", () => {
    const parsed = parseBudgetFy2025Snapshot(validSnapshot);
    const records = toBudgetAdoptedRecords(parsed);
    for (const r of records) {
      expect(r.fiscalYear).toBe(2025);
      expect(r.sourceLabel.startsWith("FY2025 adopted budget")).toBe(true);
      expect(r.sourceLabel.length).toBeGreaterThan(10);
    }
  });

  it("carries the all-funds total revenue into the right record", () => {
    const parsed = parseBudgetFy2025Snapshot(validSnapshot);
    const records = toBudgetAdoptedRecords(parsed);
    const totalRevenue = records.find((r) => r.entityId === "ent-budget-fy2025-all-funds-revenue");
    expect(totalRevenue?.amountCents).toBe(67500000000);
  });

  it("carries the General Fund expenditure into the right record", () => {
    const parsed = parseBudgetFy2025Snapshot(validSnapshot);
    const records = toBudgetAdoptedRecords(parsed);
    const gfExp = records.find((r) => r.entityId === "ent-budget-fy2025-general-fund-expenditure");
    expect(gfExp?.amountCents).toBe(25749324000);
  });
});
