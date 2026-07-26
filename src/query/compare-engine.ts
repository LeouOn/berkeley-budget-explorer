import type { BudgetValue, Comparability, Entity } from "../pipeline/canonical/schema";
import type { PopulationObservation } from "../pipeline/derive/derive";
import { type FiscalYearAverage, inflateCents } from "../pipeline/sources/bls-cpi";

export type CompareMode = "real" | "nominal";

export type CompareUnit = "absolute" | "per-resident" | "percent-change" | "share-of-total";

export interface ComparePoint {
  readonly fiscalYear: number;
  readonly amountCents: number;
  readonly comparability: Comparability;
  readonly sourceIds: readonly string[];
}

export interface CompareSeries {
  readonly entityId: string;
  readonly entityName: string;
  readonly entityType: Entity["type"];
  readonly colorIndex: number;
  readonly points: readonly ComparePoint[];
  readonly sourceLabel?: string;
}

export interface CompareResult {
  readonly series: readonly CompareSeries[];
  readonly fiscalYears: readonly number[];
}

export interface CompareInput {
  readonly values: readonly BudgetValue[];
  readonly entities: readonly Entity[];
  readonly cpi: readonly FiscalYearAverage[];
  readonly population: readonly PopulationObservation[];
  readonly entityIds: readonly string[];
  readonly yearRange: readonly [number, number];
  readonly mode: CompareMode;
  readonly unit: CompareUnit;
  readonly baseYear: number;
  readonly originalLabels?: boolean;
}

export const COMPARE_PALETTE: readonly string[] = [
  "var(--color-accent)",
  "var(--color-positive)",
  "var(--color-focus)",
  "var(--color-negative)",
];

export const MAX_COMPARE_ENTITIES = 4;

interface EntityCoverage {
  readonly minYear: number;
  readonly maxYear: number;
  readonly yearSet: Set<number>;
}

function computeCoverage(values: readonly BudgetValue[], entityId: string): EntityCoverage | null {
  const years = values
    .filter((v) => v.entityId === entityId)
    .map((v) => v.fiscalYear)
    .sort((a, b) => a - b);
  if (years.length === 0) return null;
  return {
    minYear: years[0] ?? 0,
    maxYear: years[years.length - 1] ?? 0,
    yearSet: new Set(years),
  };
}

function scaleByMode(
  nominalCents: number,
  fiscalYear: number,
  mode: CompareMode,
  baseYear: number,
  cpi: readonly FiscalYearAverage[],
): number {
  if (mode === "nominal" || fiscalYear === baseYear) return nominalCents;
  return inflateCents(nominalCents, fiscalYear, baseYear, cpi);
}

function populationFor(population: readonly PopulationObservation[], fiscalYear: number): number {
  return population.find((p) => p.fiscalYear === fiscalYear)?.estimatedPopulation ?? 0;
}

function computeShareDenominators(
  values: readonly BudgetValue[],
  yearRange: readonly [number, number],
): Map<number, number> {
  const [start, end] = yearRange;
  const totals = new Map<number, number>();
  for (const v of values) {
    if (v.fiscalYear < start || v.fiscalYear > end) continue;
    if (v.entityType !== "expense-category") continue;
    totals.set(v.fiscalYear, (totals.get(v.fiscalYear) ?? 0) + v.amountNominalCents);
  }
  return totals;
}

function applyUnit(
  amount: number,
  unit: CompareUnit,
  ctx: {
    fiscalYear: number;
    population: number;
    baseline: number;
    shareDenominator: number;
  },
): number {
  switch (unit) {
    case "absolute":
      return amount;
    case "per-resident":
      return ctx.population > 0 ? Math.round(amount / ctx.population) : 0;
    case "percent-change":
      return ctx.baseline > 0 ? Math.round(((amount - ctx.baseline) / ctx.baseline) * 10000) : 0;
    case "share-of-total":
      return ctx.shareDenominator > 0 ? Math.round((amount / ctx.shareDenominator) * 10000) : 0;
  }
}

function comparabilityFor(
  coverage: EntityCoverage,
  yearRange: readonly [number, number],
): Comparability {
  const [start, end] = yearRange;
  if (coverage.minYear > start || coverage.maxYear < end) return "approximate";
  for (let fy = start; fy <= end; fy += 1) {
    if (!coverage.yearSet.has(fy)) return "approximate";
  }
  return "exact";
}

function buildSeriesForEntity(
  entityId: string,
  input: CompareInput,
  coverage: EntityCoverage,
  shareDenominators: Map<number, number>,
  colorIndex: number,
): CompareSeries | null {
  const entity = input.entities.find((e) => e.id === entityId);
  if (!entity) return null;
  const [start, end] = input.yearRange;
  const years: number[] = [];
  for (let fy = start; fy <= end; fy += 1) years.push(fy);

  const entityValues = input.values.filter((v) => v.entityId === entityId);
  const firstYearAmount = years
    .map((fy) => entityValues.find((v) => v.fiscalYear === fy))
    .find((v): v is BudgetValue => v !== undefined);
  const baselineNominal = firstYearAmount?.amountNominalCents ?? 0;
  const baselineScaled =
    firstYearAmount !== undefined
      ? scaleByMode(
          firstYearAmount.amountNominalCents,
          firstYearAmount.fiscalYear,
          input.mode,
          input.baseYear,
          input.cpi,
        )
      : 0;

  const comp = comparabilityFor(coverage, input.yearRange);
  const points: ComparePoint[] = [];
  for (const fy of years) {
    const value = entityValues.find((v) => v.fiscalYear === fy);
    if (!value) continue;
    const scaled = scaleByMode(value.amountNominalCents, fy, input.mode, input.baseYear, input.cpi);
    const pop = populationFor(input.population, fy);
    const shareDen = shareDenominators.get(fy) ?? 0;
    const finalAmount = applyUnit(scaled, input.unit, {
      fiscalYear: fy,
      population: pop,
      baseline: baselineScaled,
      shareDenominator: shareDen,
    });
    points.push({
      fiscalYear: fy,
      amountCents: finalAmount,
      comparability: comp,
      sourceIds: [value.sourceId],
    });
  }

  return {
    entityId,
    entityName: entity.canonicalName,
    entityType: entity.type,
    colorIndex,
    points,
    ...(input.originalLabels && firstYearAmount
      ? { sourceLabel: firstYearAmount.sourceLabel }
      : {}),
  };
}

export function compareSeries(input: CompareInput): CompareResult {
  const limitedIds = input.entityIds.slice(0, MAX_COMPARE_ENTITIES);
  const shareDenominators = computeShareDenominators(input.values, input.yearRange);
  const [start, end] = input.yearRange;
  const fiscalYears: number[] = [];
  for (let fy = start; fy <= end; fy += 1) fiscalYears.push(fy);

  const series: CompareSeries[] = [];
  for (let i = 0; i < limitedIds.length; i += 1) {
    const entityId = limitedIds[i];
    if (!entityId) continue;
    const coverage = computeCoverage(input.values, entityId);
    if (!coverage) continue;
    const s = buildSeriesForEntity(entityId, input, coverage, shareDenominators, i);
    if (s) series.push(s);
  }

  return { series, fiscalYears };
}
