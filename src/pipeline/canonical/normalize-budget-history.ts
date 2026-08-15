import type { HistoryRecord } from "../sources/budget-history-transcription";
import type { SourceId } from "../sources/manifest";
import type { BudgetValue, Entity, EntityType } from "./schema";

const SCHEMA_VERSION = "1.0.0";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function budgetHistoryEntityId(record: HistoryRecord): string {
  const prefix = record.kind === "expenditure" ? "ent-bhist-exp" : "ent-bhist-rev";
  return `${prefix}-${slugify(record.name)}`;
}

function entityTypeFor(record: HistoryRecord): EntityType {
  if (record.name.startsWith("Total"))
    return record.kind === "revenue" ? "revenue-category" : "expense-category";
  return record.kind === "revenue" ? "revenue-category" : "expense-category";
}

export function buildBudgetHistoryEntities(records: readonly HistoryRecord[]): readonly Entity[] {
  const seen = new Map<string, Entity>();
  for (const r of records) {
    const id = budgetHistoryEntityId(r);
    if (seen.has(id)) continue;
    const scope =
      r.kind === "expenditure"
        ? "expenditure history table (pages 40-41)"
        : "revenue history table (page 40)";
    seen.set(id, {
      id,
      type: entityTypeFor(r),
      canonicalName: r.name,
      plainDescription: `City of Berkeley ${r.name} from the FY2025-2026 budget book ${scope}, FY2022-FY2026.`,
    });
  }
  return [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function normalizeBudgetHistory(
  records: readonly HistoryRecord[],
  sourceId: SourceId,
): readonly BudgetValue[] {
  return records
    .map((r): BudgetValue => {
      const colLabel = r.column.replace(/([A-Z])/g, " $1").toLowerCase();
      return {
        fiscalYear: r.fiscalYear,
        amountNominalCents: r.amountCents,
        stage: r.stage,
        basis: "budgetary",
        entityId: budgetHistoryEntityId(r),
        entityType: entityTypeFor(r),
        sourceId,
        sourceLabel: `Berkeley ${r.name} (${colLabel}, budget history)`,
        extractionMethod: "manual-transcription",
        confidence: "verified",
        schemaVersion: SCHEMA_VERSION,
      };
    })
    .sort((a, b) => a.entityId.localeCompare(b.entityId) || a.fiscalYear - b.fiscalYear);
}
