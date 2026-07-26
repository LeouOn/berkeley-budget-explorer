import type { BudgetValue, Comparability, Entity } from "../pipeline/canonical/schema";
import type { OverviewSnapshot, PopulationObservation } from "../pipeline/derive/derive";
import { type FiscalYearAverage, inflateCents } from "../pipeline/sources/bls-cpi";

export type DollarMode = "real" | "nominal";

export interface OverviewTrendPoint {
  readonly fiscalYear: number;
  readonly expendituresCents: number;
  readonly revenuesCents: number;
  readonly perResidentExpendituresCents: number;
  readonly perResidentRevenuesCents: number;
  readonly estimatedPopulation: number;
  readonly comparability: Comparability;
}

export interface OverviewQueryInput {
  readonly snapshot: OverviewSnapshot;
  readonly values: readonly BudgetValue[];
  readonly entities: readonly Entity[];
  readonly cpi: readonly FiscalYearAverage[];
  readonly population: readonly PopulationObservation[];
  readonly mode: DollarMode;
  readonly baseYear: number;
}

const EXPENDITURE_SOURCE_ID = "src-sco-expenditures-per-capita-ykhf-vfsr";
const REVENUE_SOURCE_ID = "src-sco-revenues-per-capita-ky7j-fsk5";

const USDFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCents(cents: number): string {
  return USDFormatter.format(cents / 100);
}

function pickScoValue(
  values: readonly BudgetValue[],
  fiscalYear: number,
  sourceId: string,
): BudgetValue | undefined {
  return values.find((v) => v.fiscalYear === fiscalYear && v.sourceId === sourceId);
}

function scaleAmount(
  nominal: number,
  fiscalYear: number,
  baseYear: number,
  mode: DollarMode,
  cpi: readonly FiscalYearAverage[],
): number {
  if (mode === "nominal" || fiscalYear === baseYear) return nominal;
  return inflateCents(nominal, fiscalYear, baseYear, cpi);
}

export function getOverviewTrend(input: OverviewQueryInput): readonly OverviewTrendPoint[] {
  const { values, cpi, population, mode, baseYear } = input;
  const years = Array.from(
    new Set(
      values
        .filter((v) => v.sourceId === EXPENDITURE_SOURCE_ID || v.sourceId === REVENUE_SOURCE_ID)
        .map((v) => v.fiscalYear),
    ),
  ).sort((a, b) => a - b);
  return years.map((fy) => {
    const exp = pickScoValue(values, fy, EXPENDITURE_SOURCE_ID);
    const rev = pickScoValue(values, fy, REVENUE_SOURCE_ID);
    const expendituresCents = exp
      ? scaleAmount(exp.amountNominalCents, fy, baseYear, mode, cpi)
      : 0;
    const revenuesCents = rev ? scaleAmount(rev.amountNominalCents, fy, baseYear, mode, cpi) : 0;
    const popEntry = population.find((p) => p.fiscalYear === fy);
    const estimatedPopulation = popEntry?.estimatedPopulation ?? 0;
    return {
      fiscalYear: fy,
      expendituresCents,
      revenuesCents,
      perResidentExpendituresCents:
        estimatedPopulation > 0 ? Math.round(expendituresCents / estimatedPopulation) : 0,
      perResidentRevenuesCents:
        estimatedPopulation > 0 ? Math.round(revenuesCents / estimatedPopulation) : 0,
      estimatedPopulation,
      comparability: "reconstructed" as const,
    };
  });
}
