import { z } from "zod";
import { parseDollarsToCents } from "./money";

// Accepts both "FY2024" (synthetic fixture) and "2024" (real SCO API).
const FiscalYearRegex = /(\d{4})$/;
const RawExpRowSchema = z.object({
  entity_name: z.string().min(1),
  fiscal_year: z.string().regex(/^(?:FY)?\d{4}$/),
  total_expenditures: z.string(),
  estimated_population: z.string(),
  expenditures_per_capita: z.string(),
});
const RawRevRowSchema = z.object({
  entity_name: z.string().min(1),
  fiscal_year: z.string().regex(/^(?:FY)?\d{4}$/),
  total_revenues: z.string(),
  estimated_population: z.string(),
  revenues_per_capita: z.string(),
});

function yearFromFYString(value: string): number {
  const m = FiscalYearRegex.exec(value);
  if (!m) throw new Error(`Invalid fiscal_year: ${value}`);
  return Number.parseInt(m[1] ?? "0", 10);
}

function requireCents(label: string, raw: string): number {
  const r = parseDollarsToCents(raw);
  if (!r.ok) throw new Error(`${label} parse failed: ${r.error.kind} (${raw})`);
  return r.value;
}

function requireIntegerPopulation(label: string, raw: string): number {
  const cents = requireCents(label, raw);
  return Math.round(cents / 100);
}

export const ScoExpenditurePerCapitaRowSchema = z.object({
  entityName: z.string().min(1),
  fiscalYear: z.number().int().min(1900).max(2100),
  totalExpendituresCents: z.number().int(),
  estimatedPopulation: z.number().int().nonnegative(),
  expendituresPerCapitaCents: z.number().int(),
});
export type ScoExpenditurePerCapitaRow = z.infer<typeof ScoExpenditurePerCapitaRowSchema>;

export const ScoRevenuePerCapitaRowSchema = z.object({
  entityName: z.string().min(1),
  fiscalYear: z.number().int().min(1900).max(2100),
  totalRevenuesCents: z.number().int(),
  estimatedPopulation: z.number().int().nonnegative(),
  revenuesPerCapitaCents: z.number().int(),
});
export type ScoRevenuePerCapitaRow = z.infer<typeof ScoRevenuePerCapitaRowSchema>;

export function parseScoExpenditurePerCapita(
  raw: readonly unknown[],
): readonly ScoExpenditurePerCapitaRow[] {
  const parsed = z.array(RawExpRowSchema).parse(raw);
  return parsed.map((r) => ({
    entityName: r.entity_name,
    fiscalYear: yearFromFYString(r.fiscal_year),
    totalExpendituresCents: requireCents("total_expenditures", r.total_expenditures),
    estimatedPopulation: requireIntegerPopulation("estimated_population", r.estimated_population),
    expendituresPerCapitaCents: requireCents("expenditures_per_capita", r.expenditures_per_capita),
  }));
}

export function parseScoRevenuePerCapita(
  raw: readonly unknown[],
): readonly ScoRevenuePerCapitaRow[] {
  const parsed = z.array(RawRevRowSchema).parse(raw);
  return parsed.map((r) => ({
    entityName: r.entity_name,
    fiscalYear: yearFromFYString(r.fiscal_year),
    totalRevenuesCents: requireCents("total_revenues", r.total_revenues),
    estimatedPopulation: requireIntegerPopulation("estimated_population", r.estimated_population),
    revenuesPerCapitaCents: requireCents("revenues_per_capita", r.revenues_per_capita),
  }));
}

// Accepts both "City of Berkeley" (fixture) and "Berkeley" (real SCO API).
export function filterBerkeley<T extends { entityName: string }>(rows: readonly T[]): readonly T[] {
  return rows.filter((r) => r.entityName === "City of Berkeley" || r.entityName === "Berkeley");
}

export function crossCheckInternal(
  rows: readonly ScoExpenditurePerCapitaRow[],
  toleranceCents = 50,
): void {
  for (const r of rows) {
    if (r.estimatedPopulation === 0) continue;
    const expected = Math.round(r.totalExpendituresCents / r.estimatedPopulation);
    const diff = Math.abs(expected - r.expendituresPerCapitaCents);
    if (diff > toleranceCents) {
      throw new Error(
        `SCO per-capita cross-check failed for FY${r.fiscalYear}: ` +
          `expected total/pop ≈ ${expected} cents, observed ${r.expendituresPerCapitaCents} cents (diff ${diff})`,
      );
    }
  }
}

export interface CitywideTrendPoint {
  readonly fiscalYear: number;
  readonly expendituresCents: number;
  readonly revenuesCents: number;
  readonly estimatedPopulation: number;
  readonly perResidentExpendituresCents: number;
  readonly perResidentRevenuesCents: number;
}

interface MutableTrendPoint {
  fiscalYear: number;
  expendituresCents: number;
  revenuesCents: number;
  estimatedPopulation: number;
  perResidentExpendituresCents: number;
  perResidentRevenuesCents: number;
}

export function citywideTrend(
  expenditureRows: readonly ScoExpenditurePerCapitaRow[],
  revenueRows: readonly ScoRevenuePerCapitaRow[],
): readonly CitywideTrendPoint[] {
  const byYear = new Map<number, MutableTrendPoint>();
  for (const r of expenditureRows) {
    const prev: MutableTrendPoint = byYear.get(r.fiscalYear) ?? {
      fiscalYear: r.fiscalYear,
      expendituresCents: 0,
      revenuesCents: 0,
      estimatedPopulation: r.estimatedPopulation,
      perResidentExpendituresCents: 0,
      perResidentRevenuesCents: 0,
    };
    prev.expendituresCents = r.totalExpendituresCents;
    prev.estimatedPopulation = r.estimatedPopulation;
    prev.perResidentExpendituresCents = r.expendituresPerCapitaCents;
    byYear.set(r.fiscalYear, prev);
  }
  for (const r of revenueRows) {
    const prev: MutableTrendPoint = byYear.get(r.fiscalYear) ?? {
      fiscalYear: r.fiscalYear,
      expendituresCents: 0,
      revenuesCents: 0,
      estimatedPopulation: r.estimatedPopulation,
      perResidentExpendituresCents: 0,
      perResidentRevenuesCents: 0,
    };
    prev.revenuesCents = r.totalRevenuesCents;
    prev.perResidentRevenuesCents = r.revenuesPerCapitaCents;
    byYear.set(r.fiscalYear, prev);
  }
  return [...byYear.values()].sort((a, b) => a.fiscalYear - b.fiscalYear);
}
