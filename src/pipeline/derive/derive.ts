import type { BudgetValue, Comparability, Entity } from "../canonical/schema";
import { type FiscalYearAverage, inflateCents } from "../sources/bls-cpi";

export interface PopulationObservation {
  readonly fiscalYear: number;
  readonly estimatedPopulation: number;
}

export interface OverviewSnapshot {
  readonly fiscalYear: number;
  readonly baseYear: number;
  readonly mode: "real" | "nominal";
  readonly surface: "sco-standardized-actuals";
  readonly expendituresCents: number;
  readonly revenuesCents: number;
  readonly perResidentExpendituresCents: number;
  readonly perResidentRevenuesCents: number;
  readonly estimatedPopulation: number;
  readonly comparability: Comparability;
  readonly sources: readonly string[];
  readonly notes: readonly string[];
}

export interface BuildOverviewInput {
  readonly values: readonly BudgetValue[];
  readonly entities: readonly Entity[];
  readonly cpi: readonly FiscalYearAverage[];
  readonly population: readonly PopulationObservation[];
  readonly targetFiscalYear: number;
  readonly mode: "real" | "nominal";
  readonly baseYear: number;
}

const EXPENDITURE_SOURCE_ID = "src-sco-expenditures-per-capita-ykhf-vfsr";
const REVENUE_SOURCE_ID = "src-sco-revenues-per-capita-ky7j-fsk5";
const BASE_NOTES = [
  "Every Overview figure is a California State Controller standardized actual for Berkeley, not an adopted budget figure.",
  "Adopted-versus-actual variance is deferred to Phase 3 (PDF and ACFR review).",
] as const;

function pickScoValue(
  values: readonly BudgetValue[],
  fiscalYear: number,
  sourceId: string,
): BudgetValue | undefined {
  return values.find((v) => v.fiscalYear === fiscalYear && v.sourceId === sourceId);
}

function scaleAmount(
  amount: number,
  mode: "real" | "nominal",
  fy: number,
  baseYear: number,
  cpi: readonly FiscalYearAverage[],
): number {
  if (mode === "nominal" || fy === baseYear) return amount;
  return inflateCents(amount, fy, baseYear, cpi);
}

export function buildOverviewSnapshot(input: BuildOverviewInput): OverviewSnapshot {
  const { values, entities, cpi, population, targetFiscalYear, mode, baseYear } = input;
  const expenditure = pickScoValue(values, targetFiscalYear, EXPENDITURE_SOURCE_ID);
  const revenue = pickScoValue(values, targetFiscalYear, REVENUE_SOURCE_ID);
  if (!expenditure) {
    throw new Error(`No SCO standardized expenditure for FY${targetFiscalYear}`);
  }
  if (!revenue) {
    throw new Error(`No SCO standardized revenue for FY${targetFiscalYear}`);
  }
  if (!entities.some((e) => e.id === "ent-citywide-berkeley")) {
    throw new Error("ent-citywide-berkeley entity missing from registry");
  }
  const expendituresCents = scaleAmount(
    expenditure.amountNominalCents,
    mode,
    targetFiscalYear,
    baseYear,
    cpi,
  );
  const revenuesCents = scaleAmount(
    revenue.amountNominalCents,
    mode,
    targetFiscalYear,
    baseYear,
    cpi,
  );
  const popEntry = population.find((p) => p.fiscalYear === targetFiscalYear);
  const estimatedPopulation = popEntry?.estimatedPopulation ?? 0;
  const perResidentExpendituresCents =
    estimatedPopulation > 0 ? Math.round(expendituresCents / estimatedPopulation) : 0;
  const perResidentRevenuesCents =
    estimatedPopulation > 0 ? Math.round(revenuesCents / estimatedPopulation) : 0;
  return {
    fiscalYear: targetFiscalYear,
    baseYear,
    mode,
    surface: "sco-standardized-actuals",
    expendituresCents,
    revenuesCents,
    perResidentExpendituresCents,
    perResidentRevenuesCents,
    estimatedPopulation,
    comparability: "reconstructed",
    sources: [EXPENDITURE_SOURCE_ID, REVENUE_SOURCE_ID],
    notes: BASE_NOTES,
  };
}

export interface TrendPoint {
  readonly fiscalYear: number;
  readonly expendituresCents: number;
  readonly revenuesCents: number;
  readonly perResidentExpendituresCents: number;
  readonly perResidentRevenuesCents: number;
  readonly comparability: Comparability;
  readonly estimatedPopulation: number;
}

export function buildOverviewTrendSeries(
  values: readonly BudgetValue[],
  cpi: readonly FiscalYearAverage[],
  population: readonly PopulationObservation[],
  mode: "real" | "nominal",
  baseYear: number,
): readonly TrendPoint[] {
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
      ? scaleAmount(exp.amountNominalCents, mode, fy, baseYear, cpi)
      : 0;
    const revenuesCents = rev ? scaleAmount(rev.amountNominalCents, mode, fy, baseYear, cpi) : 0;
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
      comparability: "reconstructed" as const,
      estimatedPopulation,
    };
  });
}
