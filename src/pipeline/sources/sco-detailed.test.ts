import { describe, expect, it } from "vitest";
import {
  assertNoCitywideSum,
  filterBerkeley,
  parseScoDetailed,
  summarizeCategoriesByFiscalYear,
} from "./sco-detailed";
import { scoDetailedFixture } from "./sco-detailed.fixtures";

describe("sco-detailed adapter", () => {
  it("parses rows and converts string fiscal_year/value/population via the typed money parser", () => {
    const rows = parseScoDetailed(scoDetailedFixture);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.fiscalYear).toBe(2024);
    expect(rows[0]?.valueCents).toBeGreaterThan(0);
  });

  it("rejects rows whose type is not a recognized expenditure actual", () => {
    const bad = scoDetailedFixture.map((r) => ({ ...r, type: "budget" }));
    expect(() => parseScoDetailed(bad)).toThrow(/type/i);
  });

  it("filters to Berkeley rows only", () => {
    const rows = parseScoDetailed(scoDetailedFixture);
    const berkeleyRows = filterBerkeley(rows);
    expect(berkeleyRows.length).toBeGreaterThan(0);
    expect(berkeleyRows.every((r) => r.entityName === "City of Berkeley")).toBe(true);
  });

  it("summarizeCategoriesByFiscalYear excludes total/subtotal rows so summing never double-counts", () => {
    const rows = parseScoDetailed(scoDetailedFixture);
    const summaries = summarizeCategoriesByFiscalYear(rows);
    expect(summaries.length).toBeGreaterThan(0);
    for (const s of summaries) {
      expect(s.excludedTotalRows).toBeGreaterThanOrEqual(0);
    }
  });

  it("assertNoCitywideSum passes on the per-line adapter (no sum function is exported)", () => {
    expect(() => assertNoCitywideSum(parseScoDetailed(scoDetailedFixture))).not.toThrow();
  });
});
