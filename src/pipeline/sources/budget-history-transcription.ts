import { z } from "zod";

const ColumnKeySchema = z.enum([
  "fy2022Actual",
  "fy2023Actual",
  "fy2024Estimated",
  "fy2024Budgeted",
  "fy2025Adopted",
  "fy2026Adopted",
]);
export type ColumnKey = z.infer<typeof ColumnKeySchema>;

export const COLUMN_META: readonly {
  readonly key: ColumnKey;
  readonly fiscalYear: number;
  readonly stage: "actual" | "projected" | "adopted";
}[] = [
  { key: "fy2022Actual", fiscalYear: 2022, stage: "actual" },
  { key: "fy2023Actual", fiscalYear: 2023, stage: "actual" },
  { key: "fy2024Estimated", fiscalYear: 2024, stage: "projected" },
  { key: "fy2024Budgeted", fiscalYear: 2024, stage: "adopted" },
  { key: "fy2025Adopted", fiscalYear: 2025, stage: "adopted" },
  { key: "fy2026Adopted", fiscalYear: 2026, stage: "adopted" },
];

const HistoryRowSchema = z.object({
  name: z.string().min(1),
  fy2022Actual: z.number().int().nonnegative(),
  fy2023Actual: z.number().int().nonnegative(),
  fy2024Estimated: z.number().int().nonnegative(),
  fy2024Budgeted: z.number().int().nonnegative(),
  fy2025Adopted: z.number().int().nonnegative(),
  fy2026Adopted: z.number().int().nonnegative(),
});

export const BudgetHistorySnapshotSchema = z.object({
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  reportType: z.literal("Budget History Tables"),
  entity: z.literal("City of Berkeley"),
  sourceDocument: z.string().min(1),
  sourceUrl: z.string().url(),
  extractedPages: z.object({
    revenueHistory: z.number().int(),
    expenditureHistory: z.number().int(),
  }),
  columnStages: z.record(z.string(), z.enum(["actual", "projected", "adopted"])),
  notes: z.string().min(1),
  expenditureCategories: z.array(HistoryRowSchema).min(1),
  revenueCategories: z.array(HistoryRowSchema).min(1),
});
export type BudgetHistorySnapshot = z.infer<typeof BudgetHistorySnapshotSchema>;

export interface HistoryRecord {
  readonly kind: "expenditure" | "revenue";
  readonly name: string;
  readonly column: ColumnKey;
  readonly fiscalYear: number;
  readonly stage: "actual" | "projected" | "adopted";
  readonly amountCents: number;
}

export function toBudgetHistoryRecords(raw: unknown): readonly HistoryRecord[] {
  const snap = BudgetHistorySnapshotSchema.parse(raw);
  const records: HistoryRecord[] = [];
  const groups: readonly {
    readonly kind: "expenditure" | "revenue";
    readonly rows: readonly z.infer<typeof HistoryRowSchema>[];
  }[] = [
    { kind: "expenditure", rows: snap.expenditureCategories },
    { kind: "revenue", rows: snap.revenueCategories },
  ];
  for (const group of groups) {
    for (const row of group.rows) {
      for (const meta of COLUMN_META) {
        records.push({
          kind: group.kind,
          name: row.name,
          column: meta.key,
          fiscalYear: meta.fiscalYear,
          stage: meta.stage,
          amountCents: row[meta.key],
        });
      }
    }
  }
  return records;
}
