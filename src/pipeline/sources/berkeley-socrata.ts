import { z } from "zod";
import { parseDollarsToCents } from "./money";

const SocrataRawRowSchema = z.object({
  fiscal_year: z.string().regex(/^(?:FY)?\d{4}$/),
  department: z.string().min(1),
  program: z.string().optional(),
  service: z.string().optional(),
  expense_category: z.string().optional(),
  approved_amount: z.string(),
  fund: z.string().min(1),
  description: z.string().optional(),
  expense_type: z.string().optional(),
  object_id: z.string().optional(),
});

const FiscalYearRegex = /(\d{4})$/;

export const SocrataRowSchema = z.object({
  fiscalYear: z.number().int().min(1900).max(2100),
  department: z.string().min(1),
  program: z.string().optional(),
  service: z.string().optional(),
  expenseCategory: z.string().optional(),
  approvedAmountCents: z.number().int(),
  fund: z.string().min(1),
  description: z.string().optional(),
  expenseType: z.string().optional(),
  objectId: z.string().optional(),
});
export type SocrataRow = z.infer<typeof SocrataRowSchema>;

function fiscalYearFromString(value: string): number {
  const match = FiscalYearRegex.exec(value);
  if (!match) throw new Error(`Invalid fiscal_year string: ${value}`);
  return Number.parseInt(match[1] ?? "0", 10);
}

export function parseSocrataRows(raw: readonly unknown[]): readonly SocrataRow[] {
  const parsedRaw = z.array(SocrataRawRowSchema).parse(raw);
  return parsedRaw.map((r) => {
    const centsResult = parseDollarsToCents(r.approved_amount);
    if (!centsResult.ok) {
      throw new Error(
        `Socrata approved_amount parse failed: ${centsResult.error.kind} (${r.approved_amount})`,
      );
    }
    const base: {
      fiscalYear: number;
      department: string;
      program?: string;
      service?: string;
      expenseCategory?: string;
      approvedAmountCents: number;
      fund: string;
      description?: string;
      expenseType?: string;
      objectId?: string;
    } = {
      fiscalYear: fiscalYearFromString(r.fiscal_year),
      department: r.department,
      approvedAmountCents: centsResult.value,
      fund: r.fund,
    };
    if (r.program !== undefined) base.program = r.program;
    if (r.service !== undefined) base.service = r.service;
    if (r.expense_category !== undefined) base.expenseCategory = r.expense_category;
    if (r.description !== undefined) base.description = r.description;
    if (r.expense_type !== undefined) base.expenseType = r.expense_type;
    if (r.object_id !== undefined) base.objectId = r.object_id;
    return base;
  });
}

export interface CohortRange {
  readonly min: number;
  readonly max: number;
}

export function cohortFiscalYears(rows: readonly SocrataRow[]): CohortRange {
  if (rows.length === 0) throw new Error("Cannot derive cohort range from empty rows");
  const years = rows.map((r) => r.fiscalYear);
  return { min: Math.min(...years), max: Math.max(...years) };
}

export function assertCohortSealed(
  rows: readonly SocrataRow[],
  fyStart: number,
  fyEnd: number,
): void {
  const out = rows.filter((r) => r.fiscalYear < fyStart || r.fiscalYear > fyEnd);
  if (out.length > 0) {
    const years = Array.from(new Set(out.map((r) => r.fiscalYear))).sort((a, b) => a - b);
    throw new Error(
      `Socrata cohort sealed to FY${fyStart}–FY${fyEnd} but found out-of-cohort rows for FY${years.join(", FY")}`,
    );
  }
}

export interface ServiceGroup {
  readonly serviceKey: string;
  readonly totalCents: number;
  readonly rowCount: number;
}

export function groupByService(rows: readonly SocrataRow[]): readonly ServiceGroup[] {
  const buckets = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const key = row.program ?? row.service ?? row.expenseCategory ?? "uncategorized";
    const bucket = buckets.get(key) ?? { total: 0, count: 0 };
    bucket.total += row.approvedAmountCents;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([serviceKey, { total, count }]) => ({
      serviceKey,
      totalCents: total,
      rowCount: count,
    }));
}
