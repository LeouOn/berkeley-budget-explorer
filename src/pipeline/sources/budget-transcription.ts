import { z } from "zod";

const CentsSchema = z.number().int();

const ExtractedPagesSchema = z.object({
  budgetMessage: z.number().int(),
  operatingOverview: z.number().int(),
  expenditureHistory: z.number().int(),
  expenditureByFund: z.number().int(),
});

const AllFundsSchema = z.object({
  totalRevenueCents: CentsSchema,
  totalExpenditureCents: CentsSchema,
});

const GeneralFundSchema = z.object({
  revenueCents: CentsSchema,
  expenditureCents: CentsSchema,
  transfersInCents: CentsSchema,
  transfersOutCents: CentsSchema,
  resultsFromOperationsCents: CentsSchema,
});

const ExpenditureByCategorySchema = z.object({
  salariesAndBenefits: CentsSchema,
  servicesAndMaterials: CentsSchema,
  capitalOutlay: CentsSchema,
  internalServicesAndAllOther: CentsSchema,
});

export const BudgetFy2025SnapshotSchema = z.object({
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  reportType: z.literal("Adopted Budget"),
  entity: z.literal("City of Berkeley"),
  fiscalYear: z.literal(2025),
  sourceDocument: z.string().min(1),
  sourceUrl: z.string().url(),
  extractedPages: ExtractedPagesSchema,
  allFunds: AllFundsSchema,
  generalFund: GeneralFundSchema,
  expenditureByCategory: ExpenditureByCategorySchema,
});
export type BudgetFy2025Snapshot = z.infer<typeof BudgetFy2025SnapshotSchema>;

export function parseBudgetFy2025Snapshot(raw: unknown): BudgetFy2025Snapshot {
  return BudgetFy2025SnapshotSchema.parse(raw);
}

export interface BudgetAdoptedRecord {
  readonly entityId: string;
  readonly fiscalYear: number;
  readonly amountCents: number;
  readonly sourceLabel: string;
}

export const ENTITY_ALL_FUNDS_REVENUE = "ent-budget-fy2025-all-funds-revenue";
export const ENTITY_ALL_FUNDS_EXPENDITURE = "ent-budget-fy2025-all-funds-expenditure";
export const ENTITY_GENERAL_FUND_REVENUE = "ent-budget-fy2025-general-fund-revenue";
export const ENTITY_GENERAL_FUND_EXPENDITURE = "ent-budget-fy2025-general-fund-expenditure";

export const BUDGET_FY2025_ENTITY_IDS = [
  ENTITY_ALL_FUNDS_REVENUE,
  ENTITY_ALL_FUNDS_EXPENDITURE,
  ENTITY_GENERAL_FUND_REVENUE,
  ENTITY_GENERAL_FUND_EXPENDITURE,
] as const;

// Emits four canonical adopted-budget records: all-funds and General Fund,
// each as a revenue and an expenditure point. Transfers and category breakdowns
// are intentionally NOT emitted as standalone BudgetValues; they are kept in
// the snapshot for traceability and variance analysis only.
export function toBudgetAdoptedRecords(
  snapshot: BudgetFy2025Snapshot,
): readonly BudgetAdoptedRecord[] {
  const fy = snapshot.fiscalYear;
  return [
    {
      entityId: ENTITY_ALL_FUNDS_REVENUE,
      fiscalYear: fy,
      amountCents: snapshot.allFunds.totalRevenueCents,
      sourceLabel: "FY2025 adopted budget: All Funds revenue",
    },
    {
      entityId: ENTITY_ALL_FUNDS_EXPENDITURE,
      fiscalYear: fy,
      amountCents: snapshot.allFunds.totalExpenditureCents,
      sourceLabel: "FY2025 adopted budget: All Funds expenditure",
    },
    {
      entityId: ENTITY_GENERAL_FUND_REVENUE,
      fiscalYear: fy,
      amountCents: snapshot.generalFund.revenueCents,
      sourceLabel: "FY2025 adopted budget: General Fund revenue",
    },
    {
      entityId: ENTITY_GENERAL_FUND_EXPENDITURE,
      fiscalYear: fy,
      amountCents: snapshot.generalFund.expenditureCents,
      sourceLabel: "FY2025 adopted budget: General Fund expenditure",
    },
  ];
}
