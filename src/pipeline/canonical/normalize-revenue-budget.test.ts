import { describe, expect, it } from "vitest";
import type { RevenueBudgetRecord } from "../sources/revenue-budget-transcription";
import { buildRevenueCategoryEntities, normalizeRevenueBudget } from "./normalize-revenue-budget";

const records: readonly RevenueBudgetRecord[] = [
  {
    entityId: "ent-revenue-cat-secured-property-taxes",
    fiscalYear: 2025,
    amountCents: 8988749600,
    sourceLabel: "FY2025 adopted budget revenue: Secured Property Taxes",
  },
  {
    entityId: "ent-revenue-cat-sales-tax",
    fiscalYear: 2025,
    amountCents: 1888423500,
    sourceLabel: "FY2025 adopted budget revenue: Sales Tax",
  },
];

describe("normalize-revenue-budget", () => {
  it("emits a verified adopted BudgetValue per record on budgetary basis", () => {
    const values = normalizeRevenueBudget(records, "src-revenue-budget-fy2025");
    expect(values).toHaveLength(2);
    for (const v of values) {
      expect(v.stage).toBe("adopted");
      expect(v.basis).toBe("budgetary");
      expect(v.extractionMethod).toBe("manual-transcription");
      expect(v.confidence).toBe("verified");
      expect(v.sourceId).toBe("src-revenue-budget-fy2025");
      expect(v.entityType).toBe("revenue-category");
      expect(v.fiscalYear).toBe(2025);
    }
  });

  it("carries entityId, amountCents, and sourceLabel through unchanged", () => {
    const values = normalizeRevenueBudget(records, "src-revenue-budget-fy2025");
    const secured = values.find((v) => v.entityId === "ent-revenue-cat-secured-property-taxes");
    expect(secured?.amountNominalCents).toBe(8988749600);
    expect(secured?.sourceLabel).toBe("FY2025 adopted budget revenue: Secured Property Taxes");
  });

  it("buildRevenueCategoryEntities returns every FY2025 category with stable ids", () => {
    const entities = buildRevenueCategoryEntities();
    expect(entities.length).toBe(11);
    for (const e of entities) {
      expect(e.type).toBe("revenue-category");
      expect(e.id.startsWith("ent-revenue-cat-")).toBe(true);
      expect(e.canonicalName.length).toBeGreaterThan(0);
      expect(e.plainDescription.length).toBeGreaterThan(0);
    }
    const ids = entities.map((e) => e.id);
    expect(ids).toContain("ent-revenue-cat-secured-property-taxes");
    expect(ids).toContain("ent-revenue-cat-business-license-taxes");
    expect(ids).toContain("ent-revenue-cat-property-transfer-tax-measure-p");
  });
});
