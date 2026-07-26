import { z } from "zod";
import { parseDollarsToCents } from "./money";

// Accepts both "FY2024" (synthetic fixture) and "2024" (real SCO API) formats.
const RawRowSchema = z.object({
  entity_name: z.string().min(1),
  fiscal_year: z.string().regex(/^(?:FY)?\d{4}$/),
  value: z.string().optional(),
  category: z.string().min(1),
  subcategory_1: z.string(),
  subcategory_2: z.string(),
  line_description: z.string().min(1),
  estimated_population: z.string(),
  type: z.string().min(1),
});

const YearRegex = /(\d{4})$/;

export const ScoDetailedRowSchema = z.object({
  entityName: z.string().min(1),
  fiscalYear: z.number().int().min(1900).max(2100),
  valueCents: z.number().int(),
  category: z.string().min(1),
  subcategory1: z.string(),
  subcategory2: z.string(),
  lineDescription: z.string().min(1),
  estimatedPopulation: z.number().int().nonnegative(),
  type: z.string().min(1),
});
export type ScoDetailedRow = z.infer<typeof ScoDetailedRowSchema>;

const VALID_TYPES = new Set(["actual", "Expenditures"]);

export function parseScoDetailed(raw: readonly unknown[]): readonly ScoDetailedRow[] {
  const parsed = z.array(RawRowSchema).parse(raw);
  return parsed
    .filter((r): r is typeof r & { value: string } => r.value !== undefined)
    .map((r) => {
      const yearMatch = YearRegex.exec(r.fiscal_year);
      if (!yearMatch) throw new Error(`Invalid fiscal_year: ${r.fiscal_year}`);
      const valueResult = parseDollarsToCents(r.value);
      if (!valueResult.ok) {
        throw new Error(`SCO detailed value parse failed: ${valueResult.error.kind} (${r.value})`);
      }
      const popResult = parseDollarsToCents(r.estimated_population);
      if (!popResult.ok) {
        throw new Error(
          `SCO detailed population parse failed: ${popResult.error.kind} (${r.estimated_population})`,
        );
      }
      if (!VALID_TYPES.has(r.type)) {
        throw new Error(
          `SCO detailed type must be an expenditure actual; received "${r.type}" for FY${yearMatch[1]}`,
        );
      }
      return {
        entityName: r.entity_name,
        fiscalYear: Number.parseInt(yearMatch[1] ?? "0", 10),
        valueCents: valueResult.value,
        category: r.category,
        subcategory1: r.subcategory_1,
        subcategory2: r.subcategory_2,
        lineDescription: r.line_description,
        estimatedPopulation: Math.round(popResult.value / 100),
        type: r.type,
      };
    });
}

// Accepts both "City of Berkeley" (fixture) and "Berkeley" (real SCO API).
export function filterBerkeley(rows: readonly ScoDetailedRow[]): readonly ScoDetailedRow[] {
  return rows.filter((r) => r.entityName === "City of Berkeley" || r.entityName === "Berkeley");
}

export interface CategorySummary {
  readonly fiscalYear: number;
  readonly category: string;
  readonly totalCents: number;
  readonly lineCount: number;
  readonly excludedTotalRows: number;
}

export function summarizeCategoriesByFiscalYear(
  rows: readonly ScoDetailedRow[],
): readonly CategorySummary[] {
  const bucketed = new Map<string, { total: number; count: number; excluded: number }>();
  for (const r of rows) {
    const lower = r.lineDescription.toLowerCase();
    const isSubtotal = lower.startsWith("total") || lower.startsWith("subtotal");
    const key = `${r.fiscalYear}::${r.category}`;
    const bucket = bucketed.get(key) ?? { total: 0, count: 0, excluded: 0 };
    if (isSubtotal) {
      bucket.excluded += 1;
    } else {
      bucket.total += r.valueCents;
      bucket.count += 1;
    }
    bucketed.set(key, bucket);
  }
  return [...bucketed.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => {
      const [year, category] = key.split("::");
      return {
        fiscalYear: Number.parseInt(year ?? "0", 10),
        category: category ?? "",
        totalCents: b.total,
        lineCount: b.count,
        excludedTotalRows: b.excluded,
      };
    });
}

export function assertNoCitywideSum(rows: readonly ScoDetailedRow[]): void {
  if (rows.length === 0) return;
  const categoryTotals = summarizeCategoriesByFiscalYear(rows);
  if (categoryTotals.length === 0) return;
  for (const summary of categoryTotals) {
    if (/^total$/i.test(summary.category) || /^subtotal$/i.test(summary.category)) {
      throw new Error(
        `sco-detailed adapter must not contain a citywide-total category; got category "${summary.category}" for FY${summary.fiscalYear}`,
      );
    }
  }
}
