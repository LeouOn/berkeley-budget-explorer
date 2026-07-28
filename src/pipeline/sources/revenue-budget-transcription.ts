import { z } from "zod";

const CentsSchema = z.number().int();

const RevenueCategoryRowSchema = z.object({
  name: z.string().min(1),
  amountCents: CentsSchema,
});

// FY2025 adopted budget revenue sub-categories transcribed from page 41 of the
// FY2025-2026 Proposed Biennial Budget. Each row is one revenue line item with
// its adopted amount in cents. The snapshot is single-year only: the budget
// book publishes a category breakdown for the upcoming fiscal year, not a
// historical series.
export const RevenueBudgetFy2025SnapshotSchema = z.object({
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  reportType: z.literal("Adopted Budget Revenue Categories"),
  entity: z.literal("City of Berkeley"),
  fiscalYear: z.literal(2025),
  sourceDocument: z.string().min(1),
  sourceUrl: z.string().url(),
  extractedPage: z.number().int().positive(),
  revenueCategories: z.array(RevenueCategoryRowSchema).min(1),
});
export type RevenueBudgetFy2025Snapshot = z.infer<typeof RevenueBudgetFy2025SnapshotSchema>;

export function parseRevenueBudgetFy2025Snapshot(raw: unknown): RevenueBudgetFy2025Snapshot {
  return RevenueBudgetFy2025SnapshotSchema.parse(raw);
}

export interface RevenueBudgetRecord {
  readonly entityId: string;
  readonly fiscalYear: number;
  readonly amountCents: number;
  readonly sourceLabel: string;
}

// Slugify a revenue category name into the canonical entity-id suffix:
// "Secured Property Taxes" -> "ent-revenue-cat-secured-property-taxes".
// Non-alphanumeric runs collapse to a single hyphen; leading/trailing hyphens
// are stripped. The non-breaking dash in "Property Transfer Tax – Measure P"
// is treated as a separator.
export function revenueCategoryEntityId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `ent-revenue-cat-${slug}`;
}

// Emits one adopted-budget record per revenue category. Each record becomes a
// single-year BudgetValue pinned to FY2025; the source has no historical
// series, so callers must not stitch these into the SCO citywide revenue trend.
export function toRevenueBudgetRecords(
  snapshot: RevenueBudgetFy2025Snapshot,
): readonly RevenueBudgetRecord[] {
  const fy = snapshot.fiscalYear;
  return snapshot.revenueCategories.map((row) => ({
    entityId: revenueCategoryEntityId(row.name),
    fiscalYear: fy,
    amountCents: row.amountCents,
    sourceLabel: `FY2025 adopted budget revenue: ${row.name}`,
  }));
}
