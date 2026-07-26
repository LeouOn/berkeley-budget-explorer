import type { SocrataRow } from "../sources/berkeley-socrata";
import { type FiscalYearAverage, MIN_COVERAGE } from "../sources/bls-cpi";
import type { ScoExpenditurePerCapitaRow } from "../sources/sco-per-capita";

export interface ReconciliationMismatch {
  readonly fiscalYear: number;
  readonly computedCents: number;
  readonly controlCents: number;
  readonly diffCents: number;
  readonly sourceId: string;
}

export type ReconciliationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly mismatches: readonly ReconciliationMismatch[] };

export function reconcileScoPerCapita(
  rows: readonly ScoExpenditurePerCapitaRow[],
): ReconciliationResult {
  const mismatches: ReconciliationMismatch[] = [];
  for (const r of rows) {
    if (r.estimatedPopulation === 0) continue;
    const expected = Math.round(r.totalExpendituresCents / r.estimatedPopulation);
    const diff = Math.abs(expected - r.expendituresPerCapitaCents);
    if (diff > 50) {
      mismatches.push({
        fiscalYear: r.fiscalYear,
        computedCents: expected,
        controlCents: r.expendituresPerCapitaCents,
        diffCents: expected - r.expendituresPerCapitaCents,
        sourceId: "src-sco-expenditures-per-capita-ykhf-vfsr",
      });
    }
  }
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}

export function reconcileBlsCoverage(averages: readonly FiscalYearAverage[]): ReconciliationResult {
  const mismatches: ReconciliationMismatch[] = [];
  for (const a of averages) {
    if (a.observationCount < MIN_COVERAGE) {
      mismatches.push({
        fiscalYear: a.fiscalYear,
        computedCents: a.observationCount,
        controlCents: MIN_COVERAGE,
        diffCents: a.observationCount - MIN_COVERAGE,
        sourceId: "src-bls-cpi-u-cuura422sa0",
      });
    }
  }
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}

export function reconcileSocrataCohort(
  rows: readonly SocrataRow[],
  fyStart: number,
  fyEnd: number,
): ReconciliationResult {
  const offending = new Map<number, number>();
  for (const row of rows) {
    if (row.fiscalYear < fyStart || row.fiscalYear > fyEnd) {
      offending.set(row.fiscalYear, (offending.get(row.fiscalYear) ?? 0) + 1);
    }
  }
  if (offending.size === 0) {
    return { ok: true };
  }
  const sortedYears = [...offending.keys()].sort((a, b) => a - b);
  const mismatches: ReconciliationMismatch[] = sortedYears.map((fy) => ({
    fiscalYear: fy,
    computedCents: 0,
    controlCents: fy,
    diffCents: -fy,
    sourceId: "src-berkeley-socrata-gy8t-iqc4",
  }));
  return { ok: false, mismatches };
}

export interface RunAllInput {
  readonly perCapitaRows: readonly ScoExpenditurePerCapitaRow[];
  readonly blsAverages: readonly FiscalYearAverage[];
  readonly socrataRows: readonly SocrataRow[];
  readonly socrataFyStart: number;
  readonly socrataFyEnd: number;
}

export function runAllReconciliations(input: RunAllInput): ReconciliationResult {
  const parts: ReconciliationResult[] = [
    reconcileScoPerCapita(input.perCapitaRows),
    reconcileBlsCoverage(input.blsAverages),
    reconcileSocrataCohort(input.socrataRows, input.socrataFyStart, input.socrataFyEnd),
  ];
  const mismatches = parts.flatMap((p) => (p.ok ? [] : p.mismatches));
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}
