import { describe, expect, it } from "vitest";
import {
  BlsCoverageIncompleteError,
  type BlsResponse,
  factorFor,
  fiscalYearAverage,
  fiscalYearOf,
  latestCompleteFiscalYear,
} from "./bls-cpi";
import { parseBlsSnapshot } from "./bls-cpi-node";
import { blsFixture, blsPartialFixture } from "./bls-cpi.fixtures";

describe("bls-cpi adapter", () => {
  it("verifies series id CUURA422SA0 and parses the wrapper shape", () => {
    const obs = parseBlsSnapshot(blsFixture);
    expect(obs.length).toBeGreaterThan(0);
  });

  it("rejects a snapshot whose series id does not match", () => {
    expect(() =>
      parseBlsSnapshot({
        Results: { seriesID: "WRONG", data: [] },
      }),
    ).toThrow(/CUURA422SA0/);
  });

  it("computes Berkeley fiscal year from a calendar month", () => {
    expect(fiscalYearOf(6, 2023)).toBe(2023);
    expect(fiscalYearOf(7, 2023)).toBe(2024);
    expect(fiscalYearOf(12, 2024)).toBe(2025);
    expect(fiscalYearOf(1, 2025)).toBe(2025);
  });

  it("reports the actual observationCount per FY (six bimonthly observations per complete FY)", () => {
    const averages = fiscalYearAverage(parseBlsSnapshot(blsFixture));
    const partial = fiscalYearAverage(parseBlsSnapshot(blsPartialFixture));
    const full = averages.find((a) => a.fiscalYear === 2024);
    expect(full?.observationCount).toBe(6);
    const partialFy = partial.find((a) => a.fiscalYear === 2024);
    expect(partialFy?.observationCount).toBeLessThan(6);
  });

  it("factorFor throws BlsCoverageIncompleteError when either FY has fewer than six bimonthly observations", () => {
    const partialAverages = fiscalYearAverage(parseBlsSnapshot(blsPartialFixture));
    expect(() => factorFor(partialAverages, 2023, 2024)).toThrow(BlsCoverageIncompleteError);
  });

  it("factorFor returns 1.0 between identical years that meet coverage", () => {
    const averages = fiscalYearAverage(parseBlsSnapshot(blsFixture));
    expect(factorFor(averages, 2024, 2024)).toBeCloseTo(1, 10);
  });

  it("latestCompleteFiscalYear returns the largest FY meeting the coverage floor", () => {
    const averages = fiscalYearAverage(parseBlsSnapshot(blsFixture));
    expect(latestCompleteFiscalYear(averages, 6)).toBe(2024);
  });
});

// Type-level assertion that BlsResponse is exported for fixture typing.
const _typeCheck: BlsResponse = blsFixture;
void _typeCheck;
