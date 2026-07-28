import type { SourceId } from "../sources/manifest";
import type { RevenueBudgetRecord } from "../sources/revenue-budget-transcription";
import { revenueCategoryEntityId } from "../sources/revenue-budget-transcription";
import type { BudgetValue, Entity, EntityType } from "./schema";

const SCHEMA_VERSION = "1.0.0";
const REVENUE_CATEGORY_ENTITY_TYPE: EntityType = "revenue-category";

// Display metadata for the FY2025 adopted budget revenue categories. The
// `plainDescription` is what surfaces in the Compare picker and the Quality
// dashboard; it intentionally repeats "FY2025" so users see the single-year
// scope next to every category label.
const REVENUE_CATEGORY_ENTITY_META: ReadonlyArray<{
  readonly id: string;
  readonly canonicalName: string;
  readonly plainDescription: string;
}> = [
  {
    id: revenueCategoryEntityId("Secured Property Taxes"),
    canonicalName: "Secured Property Taxes (FY2025 adopted)",
    plainDescription:
      "Adopted FY2025 secured property tax revenue for the City of Berkeley (budgetary basis, page 41).",
  },
  {
    id: revenueCategoryEntityId("Supplemental Taxes"),
    canonicalName: "Supplemental Taxes (FY2025 adopted)",
    plainDescription:
      "Adopted FY2025 supplemental property tax revenue for the City of Berkeley (budgetary basis, page 41).",
  },
  {
    id: revenueCategoryEntityId("Unsecured Property Taxes"),
    canonicalName: "Unsecured Property Taxes (FY2025 adopted)",
    plainDescription:
      "Adopted FY2025 unsecured property tax revenue for the City of Berkeley (budgetary basis, page 41).",
  },
  {
    id: revenueCategoryEntityId("Property Transfer Taxes"),
    canonicalName: "Property Transfer Taxes (FY2025 adopted)",
    plainDescription:
      "Adopted FY2025 property transfer tax revenue for the City of Berkeley (budgetary basis, page 41).",
  },
  {
    id: revenueCategoryEntityId("Property Transfer Tax \u2013 Measure P"),
    canonicalName: "Property Transfer Tax \u2013 Measure P (FY2025 adopted)",
    plainDescription:
      "Adopted FY2025 Measure P property transfer tax revenue for the City of Berkeley (budgetary basis, page 41).",
  },
  {
    id: revenueCategoryEntityId("Sales Tax"),
    canonicalName: "Sales Tax (FY2025 adopted)",
    plainDescription:
      "Adopted FY2025 sales tax revenue for the City of Berkeley (budgetary basis, page 41).",
  },
  {
    id: revenueCategoryEntityId("Soda Tax"),
    canonicalName: "Soda Tax (FY2025 adopted)",
    plainDescription:
      "Adopted FY2025 soda tax revenue for the City of Berkeley (budgetary basis, page 41).",
  },
  {
    id: revenueCategoryEntityId("Utility Users Taxes"),
    canonicalName: "Utility Users Taxes (FY2025 adopted)",
    plainDescription:
      "Adopted FY2025 utility users tax revenue for the City of Berkeley (budgetary basis, page 41).",
  },
  {
    id: revenueCategoryEntityId("Transient Occupancy Taxes"),
    canonicalName: "Transient Occupancy Taxes (FY2025 adopted)",
    plainDescription:
      "Adopted FY2025 transient occupancy (hotel) tax revenue for the City of Berkeley (budgetary basis, page 41).",
  },
  {
    id: revenueCategoryEntityId("Short-Term Rentals"),
    canonicalName: "Short-Term Rentals (FY2025 adopted)",
    plainDescription:
      "Adopted FY2025 short-term rental tax revenue for the City of Berkeley (budgetary basis, page 41).",
  },
  {
    id: revenueCategoryEntityId("Business License Taxes"),
    canonicalName: "Business License Taxes (FY2025 adopted)",
    plainDescription:
      "Adopted FY2025 business license tax revenue for the City of Berkeley (budgetary basis, page 41).",
  },
];

export function buildRevenueCategoryEntities(): readonly Entity[] {
  return REVENUE_CATEGORY_ENTITY_META.map((e) => ({
    id: e.id,
    type: REVENUE_CATEGORY_ENTITY_TYPE,
    canonicalName: e.canonicalName,
    plainDescription: e.plainDescription,
  }));
}

export function normalizeRevenueBudget(
  records: readonly RevenueBudgetRecord[],
  sourceId: SourceId,
): readonly BudgetValue[] {
  return records.map((r) => ({
    fiscalYear: r.fiscalYear,
    amountNominalCents: r.amountCents,
    stage: "adopted" as const,
    basis: "budgetary" as const,
    entityId: r.entityId,
    entityType: REVENUE_CATEGORY_ENTITY_TYPE,
    sourceId,
    sourceLabel: r.sourceLabel,
    extractionMethod: "manual-transcription" as const,
    confidence: "verified" as const,
    schemaVersion: SCHEMA_VERSION,
  }));
}
