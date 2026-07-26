import { describe, expect, it } from "vitest";
import type { CompareResult } from "./compare-engine";
import { comparisonToCsv } from "./csv-export";

function makeResult(): CompareResult {
  return {
    fiscalYears: [2020, 2021, 2022],
    series: [
      {
        entityId: "ent-sco-cat-a",
        entityName: "Category A",
        entityType: "expense-category",
        colorIndex: 0,
        points: [
          { fiscalYear: 2020, amountCents: 100000, comparability: "exact", sourceIds: ["src-x"] },
          { fiscalYear: 2021, amountCents: 110000, comparability: "exact", sourceIds: ["src-x"] },
          { fiscalYear: 2022, amountCents: 120000, comparability: "exact", sourceIds: ["src-x"] },
        ],
      },
      {
        entityId: "ent-sco-cat-b",
        entityName: "Category B",
        entityType: "expense-category",
        colorIndex: 1,
        points: [
          {
            fiscalYear: 2020,
            amountCents: 50000,
            comparability: "approximate",
            sourceIds: ["src-x"],
          },
          {
            fiscalYear: 2022,
            amountCents: 70000,
            comparability: "approximate",
            sourceIds: ["src-x"],
          },
        ],
      },
    ],
  };
}

describe("comparisonToCsv", () => {
  it("produces a header row with Fiscal Year and entity names", () => {
    const csv = comparisonToCsv(makeResult(), false);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("Fiscal Year,Category A,Category B");
  });

  it("produces one row per fiscal year sorted ascending", () => {
    const csv = comparisonToCsv(makeResult(), false);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[1]?.startsWith("2020,")).toBe(true);
    expect(lines[2]?.startsWith("2021,")).toBe(true);
    expect(lines[3]?.startsWith("2022,")).toBe(true);
  });

  it("fills missing data points with empty string", () => {
    const csv = comparisonToCsv(makeResult(), false);
    const lines = csv.trim().split("\n");
    expect(lines[2]).toBe("2021,110000,");
    expect(lines[3]).toBe("2022,120000,70000");
  });

  it("formats percentage values as decimals when isPercentage is true", () => {
    const result: CompareResult = {
      fiscalYears: [2020, 2021],
      series: [
        {
          entityId: "ent-x",
          entityName: "X",
          entityType: "expense-category",
          colorIndex: 0,
          points: [
            { fiscalYear: 2020, amountCents: 0, comparability: "exact", sourceIds: ["s"] },
            { fiscalYear: 2021, amountCents: 500, comparability: "exact", sourceIds: ["s"] },
          ],
        },
      ],
    };
    const csv = comparisonToCsv(result, true);
    const lines = csv.trim().split("\n");
    expect(lines[1]).toBe("2020,0.00");
    expect(lines[2]).toBe("2021,5.00");
  });

  it("escapes entity names containing commas", () => {
    const result: CompareResult = {
      fiscalYears: [2020],
      series: [
        {
          entityId: "ent-x",
          entityName: "Health, Culture, Leisure",
          entityType: "expense-category",
          colorIndex: 0,
          points: [
            { fiscalYear: 2020, amountCents: 100, comparability: "exact", sourceIds: ["s"] },
          ],
        },
      ],
    };
    const csv = comparisonToCsv(result, false);
    expect(csv.split("\n")[0]).toBe('Fiscal Year,"Health, Culture, Leisure"');
  });

  it("returns a header-only CSV when result is empty", () => {
    const csv = comparisonToCsv({ series: [], fiscalYears: [] }, false);
    expect(csv.trim()).toBe("Fiscal Year");
  });

  it("appends citation footer when metadata is supplied", () => {
    const csv = comparisonToCsv(makeResult(), false, {
      generatedAt: "2026-07-26T00:00:00Z",
      sourceIds: ["src-x", "src-y"],
      earliestRetrievedAt: "2026-07-20",
    });
    const lines = csv.split("\n");
    expect(lines).toContain("# Source: Berkeley Budget Explorer (berkeley-budget.example)");
    expect(lines).toContain("# Generated: 2026-07-26T00:00:00Z");
    expect(lines).toContain("# Sources: src-x,src-y");
    expect(lines).toContain("# Data retrieved: 2026-07-20");
    expect(lines).toContain("# Full methodology: /#/methodology");
  });

  it("omits citation footer when metadata is absent", () => {
    const csv = comparisonToCsv(makeResult(), false);
    expect(csv).not.toContain("# Source:");
  });

  it("uses an empty earliest-retrieved string when no sources match the manifest", () => {
    const csv = comparisonToCsv(makeResult(), false, {
      generatedAt: "2026-07-26T00:00:00Z",
      sourceIds: [],
      earliestRetrievedAt: "",
    });
    expect(csv).toContain("# Data retrieved: ");
  });
});
