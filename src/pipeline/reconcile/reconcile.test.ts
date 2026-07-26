import { describe, expect, it } from "vitest";
import { assertCohortSealed, parseSocrataRows } from "../sources/berkeley-socrata";
import { socrataFixture } from "../sources/berkeley-socrata.fixtures";
import { fiscalYearAverage, parseBlsSnapshot } from "../sources/bls-cpi";
import { blsFixture, blsPartialFixture } from "../sources/bls-cpi.fixtures";
import { parseScoExpenditurePerCapita } from "../sources/sco-per-capita";
import {
  reconcileBlsCoverage,
  reconcileScoPerCapita,
  reconcileSocrataCohort,
  runAllReconciliations,
} from "./reconcile";
import { scoExpenditurePerCapitaFixture } from "./reconcile.fixtures";

describe("reconcile", () => {
  it("reconcileScoPerCapita passes when total/population matches per-capita within 50 cents", () => {
    const rows = parseScoExpenditurePerCapita(scoExpenditurePerCapitaFixture);
    expect(reconcileScoPerCapita(rows).ok).toBe(true);
  });

  it("reconcileScoPerCapita flags rows whose per-capita value disagrees", () => {
    const rows = parseScoExpenditurePerCapita([
      ...scoExpenditurePerCapitaFixture,
      {
        entity_name: "City of Berkeley",
        fiscal_year: "FY2023",
        total_expenditures: "600000000.00",
        estimated_population: "121000",
        expenditures_per_capita: "9999.99",
      },
    ]);
    const result = reconcileScoPerCapita(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.mismatches[0]?.fiscalYear).toBe(2023);
  });

  it("reconcileBlsCoverage passes when every FY has ≥ MIN_COVERAGE observations", () => {
    const averages = fiscalYearAverage(parseBlsSnapshot(blsFixture));
    expect(reconcileBlsCoverage(averages).ok).toBe(true);
  });

  it("reconcileBlsCoverage flags any FY below MIN_COVERAGE", () => {
    const averages = fiscalYearAverage(parseBlsSnapshot(blsPartialFixture));
    const result = reconcileBlsCoverage(averages);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.mismatches.some((m) => m.fiscalYear === 2024)).toBe(true);
  });

  it("reconcileSocrataCohort passes when every row is in FY2012–FY2015", () => {
    const rows = parseSocrataRows(socrataFixture);
    expect(() => assertCohortSealed(rows, 2012, 2015)).not.toThrow();
    expect(reconcileSocrataCohort(rows, 2012, 2015).ok).toBe(true);
  });

  it("reconcileSocrataCohort returns one mismatch per offending fiscal year", () => {
    const rows = parseSocrataRows(socrataFixture).map((r) => ({ ...r, fiscalYear: 2020 }));
    const result = reconcileSocrataCohort(rows, 2012, 2015);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.mismatches.length).toBe(1);
      expect(result.mismatches[0]?.fiscalYear).toBe(2020);
      expect(result.mismatches[0]?.sourceId).toBe("src-berkeley-socrata-gy8t-iqc4");
    }
  });

  it("reconcileSocrataCohort reports every distinct offending fiscal year separately", () => {
    const baseRows = parseSocrataRows(socrataFixture);
    const off2016 = baseRows.map((r) => ({ ...r, fiscalYear: 2016 }));
    const off2020 = baseRows.map((r) => ({ ...r, fiscalYear: 2020 }));
    const mixed = [...off2016, ...off2020];
    const result = reconcileSocrataCohort(mixed, 2012, 2015);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const years = result.mismatches.map((m) => m.fiscalYear).sort((a, b) => a - b);
      expect(years).toEqual([2016, 2020]);
      for (const m of result.mismatches) {
        expect(m.fiscalYear).not.toBe(0);
        expect(m.sourceId).toBe("src-berkeley-socrata-gy8t-iqc4");
      }
    }
  });

  it("runAllReconciliations aggregates failures with the offending source id", () => {
    const outOfCohort = parseSocrataRows(socrataFixture).map((r) => ({ ...r, fiscalYear: 2020 }));
    const result = runAllReconciliations({
      perCapitaRows: parseScoExpenditurePerCapita(scoExpenditurePerCapitaFixture),
      blsAverages: fiscalYearAverage(parseBlsSnapshot(blsFixture)),
      socrataRows: outOfCohort,
      socrataFyStart: 2012,
      socrataFyEnd: 2015,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.mismatches.every((m) => m.sourceId.length > 0)).toBe(true);
    }
  });
});
