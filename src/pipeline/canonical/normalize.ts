import type { AcfrGovernmentalFundsRecord } from "../sources/acfr-transcription";
import type { SocrataRow } from "../sources/berkeley-socrata";
import type { SourceId } from "../sources/manifest";
import type { CategorySummary } from "../sources/sco-detailed";
import type { ScoExpenditurePerCapitaRow, ScoRevenuePerCapitaRow } from "../sources/sco-per-capita";
import type { BudgetValue, Entity, EntityType } from "./schema";

const SCHEMA_VERSION = "1.0.0";
const CITYWIDE_ENTITY_ID = "ent-citywide-berkeley" as const;
const CITYWIDE_ENTITY_TYPE: EntityType = "service";
const CATEGORY_ENTITY_TYPE: EntityType = "expense-category";
export const CITYWIDE_EXPENDITURE_ENTITY_ID = "ent-citywide-expenditure" as const;
const CITYWIDE_EXPENDITURE_ENTITY_TYPE: EntityType = "expense-category";
export const CITYWIDE_REVENUE_ENTITY_ID = "ent-citywide-revenue" as const;
const CITYWIDE_REVENUE_ENTITY_TYPE: EntityType = "revenue-category";

function socrataEntityType(
  program: string | undefined,
  expenseCategory: string | undefined,
): EntityType {
  if (program && program.length > 0) return "program";
  if (expenseCategory && expenseCategory.length > 0) return "expense-category";
  return "service";
}

export function slugEntityId(prefix: string, key: string): string {
  const slug = key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefix}-${slug}`;
}

export function normalizeSocrata(
  rows: readonly SocrataRow[],
  sourceId: SourceId,
): readonly BudgetValue[] {
  return rows.map((row) => {
    const entityKey = row.program ?? row.expenseCategory ?? row.service ?? row.department;
    return {
      fiscalYear: row.fiscalYear,
      amountNominalCents: row.approvedAmountCents,
      stage: "adopted" as const,
      basis: "budgetary" as const,
      entityId: slugEntityId("ent", entityKey),
      entityType: socrataEntityType(row.program, row.expenseCategory),
      sourceId,
      sourceLabel: `${row.department} / ${entityKey} (${row.fund})`,
      extractionMethod: "api" as const,
      confidence: "verified" as const,
      schemaVersion: SCHEMA_VERSION,
    };
  });
}

export function normalizeScoExpenditurePerCapita(
  rows: readonly ScoExpenditurePerCapitaRow[],
  sourceId: SourceId,
): readonly BudgetValue[] {
  return rows.map((row) => ({
    fiscalYear: row.fiscalYear,
    amountNominalCents: row.totalExpendituresCents,
    stage: "actual" as const,
    basis: "gaap" as const,
    entityId: CITYWIDE_EXPENDITURE_ENTITY_ID,
    entityType: CITYWIDE_EXPENDITURE_ENTITY_TYPE,
    sourceId,
    sourceLabel: `${row.entityName} total expenditures (per-capita dataset, FY${row.fiscalYear})`,
    extractionMethod: "api" as const,
    confidence: "verified" as const,
    schemaVersion: SCHEMA_VERSION,
  }));
}

export function normalizeScoRevenuePerCapita(
  rows: readonly ScoRevenuePerCapitaRow[],
  sourceId: SourceId,
): readonly BudgetValue[] {
  return rows.map((row) => ({
    fiscalYear: row.fiscalYear,
    amountNominalCents: row.totalRevenuesCents,
    stage: "actual" as const,
    basis: "gaap" as const,
    entityId: CITYWIDE_REVENUE_ENTITY_ID,
    entityType: CITYWIDE_REVENUE_ENTITY_TYPE,
    sourceId,
    sourceLabel: `${row.entityName} total revenues (per-capita dataset, FY${row.fiscalYear})`,
    extractionMethod: "api" as const,
    confidence: "verified" as const,
    schemaVersion: SCHEMA_VERSION,
  }));
}

// CRITICAL invariant: category totals must never be summed into the citywide
// total. The citywide total comes exclusively from the per-capita datasets.
export function normalizeScoDetailedCategories(
  summaries: readonly CategorySummary[],
  sourceId: SourceId,
): readonly BudgetValue[] {
  return summaries.map((s) => ({
    fiscalYear: s.fiscalYear,
    amountNominalCents: s.totalCents,
    stage: "actual" as const,
    basis: "gaap" as const,
    entityId: slugEntityId("ent-sco-cat", s.category),
    entityType: CATEGORY_ENTITY_TYPE,
    sourceId,
    sourceLabel: `Berkeley ${s.category} (SCO detailed, FY${s.fiscalYear})`,
    extractionMethod: "api" as const,
    confidence: "verified" as const,
    schemaVersion: SCHEMA_VERSION,
  }));
}

export function buildScoCategoryEntities(summaries: readonly CategorySummary[]): readonly Entity[] {
  const seen = new Set<string>();
  const list: Entity[] = [];
  for (const s of summaries) {
    const id = slugEntityId("ent-sco-cat", s.category);
    if (seen.has(id)) continue;
    seen.add(id);
    list.push({
      id,
      type: CATEGORY_ENTITY_TYPE,
      canonicalName: s.category,
      plainDescription: `State Controller detailed expenditure category: ${s.category}.`,
    });
  }
  return list;
}

const ACFR_FUND_ENTITY_TYPE: EntityType = "fund";

const ACFR_FUND_ENTITY_META: ReadonlyArray<{
  readonly id: string;
  readonly canonicalName: string;
  readonly plainDescription: string;
}> = [
  {
    id: "ent-acfr-gov-funds-total-revenue",
    canonicalName: "ACFR FY2025 All Governmental Funds Revenue",
    plainDescription:
      "Audited total revenue across all Berkeley governmental funds for FY2025 (ACFR modified-accrual).",
  },
  {
    id: "ent-acfr-gov-funds-total-expenditure",
    canonicalName: "ACFR FY2025 All Governmental Funds Expenditure",
    plainDescription:
      "Audited total expenditure across all Berkeley governmental funds for FY2025 (ACFR modified-accrual).",
  },
  {
    id: "ent-acfr-gov-funds-fund-balance",
    canonicalName: "ACFR FY2025 All Governmental Funds Fund Balance",
    plainDescription:
      "Audited ending fund balance across all Berkeley governmental funds at FY2025 year-end (ACFR modified-accrual).",
  },
  {
    id: "ent-acfr-general-fund-revenue",
    canonicalName: "ACFR FY2025 General Fund Revenue",
    plainDescription:
      "Audited General Fund revenue for the City of Berkeley FY2025 (ACFR modified-accrual).",
  },
  {
    id: "ent-acfr-general-fund-expenditure",
    canonicalName: "ACFR FY2025 General Fund Expenditure",
    plainDescription:
      "Audited General Fund expenditure for the City of Berkeley FY2025 (ACFR modified-accrual).",
  },
  {
    id: "ent-acfr-general-fund-balance",
    canonicalName: "ACFR FY2025 General Fund Fund Balance",
    plainDescription:
      "Audited General Fund ending balance for the City of Berkeley at FY2025 year-end (ACFR modified-accrual).",
  },
];

export function buildAcfrEntities(): readonly Entity[] {
  return ACFR_FUND_ENTITY_META.map((e) => ({
    id: e.id,
    type: ACFR_FUND_ENTITY_TYPE,
    canonicalName: e.canonicalName,
    plainDescription: e.plainDescription,
  }));
}

export function normalizeAcfrGovernmentalFunds(
  records: readonly AcfrGovernmentalFundsRecord[],
  sourceId: SourceId,
): readonly BudgetValue[] {
  return records.map((r) => ({
    fiscalYear: r.fiscalYear,
    amountNominalCents: r.amountCents,
    stage: "actual" as const,
    basis: "modified-accrual" as const,
    entityId: r.entityId,
    entityType: ACFR_FUND_ENTITY_TYPE,
    sourceId,
    sourceLabel: r.sourceLabel,
    extractionMethod: "manual-transcription" as const,
    confidence: "verified" as const,
    schemaVersion: SCHEMA_VERSION,
  }));
}

const CITYWIDE_ENTITY_META: ReadonlyArray<{
  readonly id: string;
  readonly type: EntityType;
  readonly canonicalName: string;
  readonly plainDescription: string;
}> = [
  {
    id: CITYWIDE_ENTITY_ID,
    type: CITYWIDE_ENTITY_TYPE,
    canonicalName: "Citywide Berkeley Operations",
    plainDescription: "Citywide total reported by the State Controller per-capita datasets.",
  },
  {
    id: CITYWIDE_EXPENDITURE_ENTITY_ID,
    type: CITYWIDE_EXPENDITURE_ENTITY_TYPE,
    canonicalName: "Citywide Total Expenditures (SCO per-capita)",
    plainDescription:
      "Authoritative City of Berkeley total expenditures FY2003-FY2024 from the State Controller per-capita dataset.",
  },
  {
    id: CITYWIDE_REVENUE_ENTITY_ID,
    type: CITYWIDE_REVENUE_ENTITY_TYPE,
    canonicalName: "Citywide Total Revenues (SCO per-capita)",
    plainDescription:
      "Authoritative City of Berkeley total revenues FY2003-FY2024 from the State Controller per-capita dataset.",
  },
];

export function buildCitywideEntities(): readonly Entity[] {
  return CITYWIDE_ENTITY_META.map((e) => ({
    id: e.id,
    type: e.type,
    canonicalName: e.canonicalName,
    plainDescription: e.plainDescription,
  }));
}
