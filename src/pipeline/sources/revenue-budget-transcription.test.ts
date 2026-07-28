import { describe, expect, it } from "vitest";
import {
  parseRevenueBudgetFy2025Snapshot,
  revenueCategoryEntityId,
  toRevenueBudgetRecords,
} from "./revenue-budget-transcription";

const validSnapshot = {
  schemaVersion: "1.0.0",
  reportType: "Adopted Budget Revenue Categories",
  entity: "City of Berkeley",
  fiscalYear: 2025,
  sourceDocument: "FY 2025-2026 Proposed Biennial Budget",
  sourceUrl:
    "https://berkeleyca.gov/sites/default/files/documents/FY-2025-2026-Proposed-Biennial-Budget.pdf",
  extractedPage: 41,
  revenueCategories: [
    { name: "Secured Property Taxes", amountCents: 8988749600 },
    { name: "Sales Tax", amountCents: 1888423500 },
    { name: "Property Transfer Tax \u2013 Measure P", amountCents: 619958000 },
  ],
};

describe("FY2025 revenue budget transcription adapter", () => {
  it("parses a valid snapshot", () => {
    expect(() => parseRevenueBudgetFy2025Snapshot(validSnapshot)).not.toThrow();
  });

  it("rejects an entity other than City of Berkeley", () => {
    const bad = { ...validSnapshot, entity: "Oakland" };
    expect(() => parseRevenueBudgetFy2025Snapshot(bad)).toThrow();
  });

  it("rejects a fiscal year other than 2025", () => {
    const bad = { ...validSnapshot, fiscalYear: 2024 };
    expect(() => parseRevenueBudgetFy2025Snapshot(bad)).toThrow();
  });

  it("rejects a reportType other than the revenue-categories literal", () => {
    const bad = { ...validSnapshot, reportType: "Adopted Budget" };
    expect(() => parseRevenueBudgetFy2025Snapshot(bad)).toThrow();
  });

  it("rejects non-integer cent values", () => {
    const bad = {
      ...validSnapshot,
      revenueCategories: [{ name: "Sales Tax", amountCents: 1888423500.5 }],
    };
    expect(() => parseRevenueBudgetFy2025Snapshot(bad)).toThrow();
  });

  it("rejects an empty revenue-categories array", () => {
    const bad = { ...validSnapshot, revenueCategories: [] };
    expect(() => parseRevenueBudgetFy2025Snapshot(bad)).toThrow();
  });

  it("revenueCategoryEntityId slugifies names into stable ent-revenue-cat-* ids", () => {
    expect(revenueCategoryEntityId("Secured Property Taxes")).toBe(
      "ent-revenue-cat-secured-property-taxes",
    );
    expect(revenueCategoryEntityId("Sales Tax")).toBe("ent-revenue-cat-sales-tax");
    expect(revenueCategoryEntityId("Property Transfer Tax \u2013 Measure P")).toBe(
      "ent-revenue-cat-property-transfer-tax-measure-p",
    );
  });

  it("emits one record per revenue category stamped with FY2025", () => {
    const parsed = parseRevenueBudgetFy2025Snapshot(validSnapshot);
    const records = toRevenueBudgetRecords(parsed);
    expect(records).toHaveLength(3);
    for (const r of records) {
      expect(r.fiscalYear).toBe(2025);
      expect(r.entityId.startsWith("ent-revenue-cat-")).toBe(true);
      expect(r.sourceLabel.startsWith("FY2025 adopted budget revenue:")).toBe(true);
    }
  });

  it("carries the secured-property-tax amount into the matching record", () => {
    const parsed = parseRevenueBudgetFy2025Snapshot(validSnapshot);
    const records = toRevenueBudgetRecords(parsed);
    const secured = records.find((r) => r.entityId === "ent-revenue-cat-secured-property-taxes");
    expect(secured?.amountCents).toBe(8988749600);
  });
});
