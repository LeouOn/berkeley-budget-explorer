import type { BudgetAdoptedRecord } from "../sources/budget-transcription";
import type { SourceId } from "../sources/manifest";
import type { BudgetValue, Entity, EntityType } from "./schema";

const SCHEMA_VERSION = "1.0.0";
const BUDGET_ENTITY_TYPE: EntityType = "service";

const BUDGET_ENTITY_META: ReadonlyArray<{
  readonly id: string;
  readonly canonicalName: string;
  readonly plainDescription: string;
}> = [
  {
    id: "ent-budget-fy2025-all-funds-revenue",
    canonicalName: "FY2025 Adopted Budget: All Funds Revenue",
    plainDescription:
      "Adopted FY2025 revenue across all Berkeley funds (budgetary basis, adopted-biennial-budget book).",
  },
  {
    id: "ent-budget-fy2025-all-funds-expenditure",
    canonicalName: "FY2025 Adopted Budget: All Funds Expenditure",
    plainDescription:
      "Adopted FY2025 expenditure across all Berkeley funds (budgetary basis, adopted-biennial-budget book).",
  },
  {
    id: "ent-budget-fy2025-general-fund-revenue",
    canonicalName: "FY2025 Adopted Budget: General Fund Revenue",
    plainDescription:
      "Adopted FY2025 General Fund revenue for the City of Berkeley (budgetary basis).",
  },
  {
    id: "ent-budget-fy2025-general-fund-expenditure",
    canonicalName: "FY2025 Adopted Budget: General Fund Expenditure",
    plainDescription:
      "Adopted FY2025 General Fund expenditure for the City of Berkeley (budgetary basis).",
  },
];

export function buildBudgetEntities(): readonly Entity[] {
  return BUDGET_ENTITY_META.map((e) => ({
    id: e.id,
    type: BUDGET_ENTITY_TYPE,
    canonicalName: e.canonicalName,
    plainDescription: e.plainDescription,
  }));
}

export function normalizeBudgetAdopted(
  records: readonly BudgetAdoptedRecord[],
  sourceId: SourceId,
): readonly BudgetValue[] {
  return records.map((r) => ({
    fiscalYear: r.fiscalYear,
    amountNominalCents: r.amountCents,
    stage: "adopted" as const,
    basis: "budgetary" as const,
    entityId: r.entityId,
    entityType: BUDGET_ENTITY_TYPE,
    sourceId,
    sourceLabel: r.sourceLabel,
    extractionMethod: "manual-transcription" as const,
    confidence: "verified" as const,
    schemaVersion: SCHEMA_VERSION,
  }));
}
