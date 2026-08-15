import { describe, expect, it } from "vitest";
import { COLUMN_META, toBudgetHistoryRecords } from "./budget-history-transcription";

const validSnapshot = {
  schemaVersion: "1.0.0",
  reportType: "Budget History Tables",
  entity: "City of Berkeley",
  sourceDocument: "FY 2025-2026 Adopted Biennial Budget",
  sourceUrl:
    "https://berkeleyca.gov/sites/default/files/documents/FY-2025-2026-Proposed-Biennial-Budget.pdf",
  extractedPages: { revenueHistory: 40, expenditureHistory: 41 },
  columnStages: {
    fy2022Actual: "actual",
    fy2023Actual: "actual",
    fy2024Estimated: "projected",
    fy2024Budgeted: "adopted",
    fy2025Adopted: "adopted",
    fy2026Adopted: "adopted",
  },
  notes: "test fixture",
  expenditureCategories: [
    {
      name: "Salaries & Benefits",
      fy2022Actual: 100000,
      fy2023Actual: 110000,
      fy2024Estimated: 120000,
      fy2024Budgeted: 125000,
      fy2025Adopted: 130000,
      fy2026Adopted: 135000,
    },
    {
      name: "Total Expenditures",
      fy2022Actual: 100000,
      fy2023Actual: 110000,
      fy2024Estimated: 120000,
      fy2024Budgeted: 125000,
      fy2025Adopted: 130000,
      fy2026Adopted: 135000,
    },
  ],
  revenueCategories: [
    {
      name: "Secured Property Taxes",
      fy2022Actual: 50000,
      fy2023Actual: 55000,
      fy2024Estimated: 60000,
      fy2024Budgeted: 62000,
      fy2025Adopted: 65000,
      fy2026Adopted: 68000,
    },
  ],
};

describe("budget-history-transcription", () => {
  it("expands each row into 6 records (one per column)", () => {
    const records = toBudgetHistoryRecords(validSnapshot);
    expect(records.length).toBe(18);
  });

  it("stages FY2024 estimated as projected, never actual", () => {
    const records = toBudgetHistoryRecords(validSnapshot);
    const est = records.filter((r) => r.column === "fy2024Estimated");
    expect(est.length).toBe(3);
    expect(est.every((r) => r.stage === "projected")).toBe(true);
  });

  it("stages FY2022/FY2023 as actual and adopted columns as adopted", () => {
    const records = toBudgetHistoryRecords(validSnapshot);
    const actuals = records.filter(
      (r) => r.column === "fy2022Actual" || r.column === "fy2023Actual",
    );
    expect(actuals.every((r) => r.stage === "actual")).toBe(true);
    const adopted = records.filter(
      (r) =>
        r.column.startsWith("fy2025") ||
        r.column.startsWith("fy2026") ||
        r.column === "fy2024Budgeted",
    );
    expect(adopted.every((r) => r.stage === "adopted")).toBe(true);
  });

  it("distinguishes expenditure from revenue kinds", () => {
    const records = toBudgetHistoryRecords(validSnapshot);
    const exp = records.filter((r) => r.kind === "expenditure");
    const rev = records.filter((r) => r.kind === "revenue");
    expect(exp.length).toBe(12);
    expect(rev.length).toBe(6);
  });

  it("rejects a snapshot with the wrong report type", () => {
    expect(() =>
      toBudgetHistoryRecords({ ...validSnapshot, reportType: "Adopted Budget" }),
    ).toThrow();
  });

  it("rejects negative amounts", () => {
    expect(() =>
      toBudgetHistoryRecords({
        ...validSnapshot,
        expenditureCategories: [{ ...validSnapshot.expenditureCategories[0]!, fy2022Actual: -1 }],
      }),
    ).toThrow();
  });

  it("column meta covers six columns across FY2022-FY2026", () => {
    expect(COLUMN_META.length).toBe(6);
    const years = COLUMN_META.map((c) => c.fiscalYear);
    expect(Math.min(...years)).toBe(2022);
    expect(Math.max(...years)).toBe(2026);
  });
});
