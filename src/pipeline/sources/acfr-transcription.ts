import { z } from "zod";

const FundGroupTotalsSchema = z.object({
  totalRevenueCents: z.number().int(),
  totalExpenditureCents: z.number().int(),
  endingFundBalanceCents: z.number().int(),
});

const AllGovernmentalFundsSchema = FundGroupTotalsSchema.extend({
  netChangeInFundBalanceCents: z.number().int(),
});

const FundBreakdownRowSchema = z.object({
  revenue: z.number().int(),
  expenditure: z.number().int(),
  fundBalance: z.number().int(),
});

const FundBreakdownSchema = z.object({
  generalFund: FundBreakdownRowSchema,
  capitalProjectsFund: FundBreakdownRowSchema,
  measureOGrrants: FundBreakdownRowSchema,
  housing: FundBreakdownRowSchema,
  libraryImprovementBond: FundBreakdownRowSchema,
  otherGovFunds: FundBreakdownRowSchema,
});

const FundGroupsSchema = z.object({
  generalFund: FundGroupTotalsSchema,
  allGovernmentalFunds: AllGovernmentalFundsSchema,
  breakdown: FundBreakdownSchema,
});

const SourcePagesSchema = z.object({
  balanceSheet: z.number().int(),
  govFundsStatement: z.number().int(),
  reconciliation: z.number().int(),
});

const ExpenditureByFunctionSchema = z.object({
  generalGovernment: z.number().int(),
  publicSafety: z.number().int(),
  highwayAndStreets: z.number().int(),
  healthAndWelfare: z.number().int(),
  cultureRecreation: z.number().int(),
  communityDevelopmentAndHousing: z.number().int(),
  economicDevelopment: z.number().int(),
  debtServicePrincipal: z.number().int(),
  debtServiceInterest: z.number().int(),
  capitalOutlay: z.number().int(),
});

export const AcfrFy2025SnapshotSchema = z.object({
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  reportType: z.literal("ACFR"),
  entity: z.literal("City of Berkeley"),
  fiscalYear: z.literal(2025),
  fiscalYearEnd: z.literal("2025-06-30"),
  sourcePages: SourcePagesSchema,
  fundGroups: FundGroupsSchema,
  expenditureByFunction: ExpenditureByFunctionSchema,
});
export type AcfrFy2025Snapshot = z.infer<typeof AcfrFy2025SnapshotSchema>;

export function parseAcfrFy2025Snapshot(raw: unknown): AcfrFy2025Snapshot {
  return AcfrFy2025SnapshotSchema.parse(raw);
}

export interface AcfrGovernmentalFundsRecord {
  readonly entityId: string;
  readonly fiscalYear: number;
  readonly amountCents: number;
  readonly sourceLabel: string;
}

const ENTITY_FUND_TOTAL_REVENUE = "ent-acfr-gov-funds-total-revenue";
const ENTITY_FUND_TOTAL_EXPENDITURE = "ent-acfr-gov-funds-total-expenditure";
const ENTITY_FUND_BALANCE = "ent-acfr-gov-funds-fund-balance";
const ENTITY_GENERAL_FUND_REVENUE = "ent-acfr-general-fund-revenue";
const ENTITY_GENERAL_FUND_EXPENDITURE = "ent-acfr-general-fund-expenditure";
const ENTITY_GENERAL_FUND_BALANCE = "ent-acfr-general-fund-balance";

export const ACFR_GOVERNMENTAL_FUNDS_ENTITY_IDS = [
  ENTITY_FUND_TOTAL_REVENUE,
  ENTITY_FUND_TOTAL_EXPENDITURE,
  ENTITY_FUND_BALANCE,
  ENTITY_GENERAL_FUND_REVENUE,
  ENTITY_GENERAL_FUND_EXPENDITURE,
  ENTITY_GENERAL_FUND_BALANCE,
] as const;

export function toAcfrGovernmentalFundsRecords(
  snapshot: AcfrFy2025Snapshot,
): readonly AcfrGovernmentalFundsRecord[] {
  const fy = snapshot.fiscalYear;
  const all = snapshot.fundGroups.allGovernmentalFunds;
  const gf = snapshot.fundGroups.generalFund;
  return [
    {
      entityId: ENTITY_FUND_TOTAL_REVENUE,
      fiscalYear: fy,
      amountCents: all.totalRevenueCents,
      sourceLabel: "ACFR FY2025 total governmental funds revenue",
    },
    {
      entityId: ENTITY_FUND_TOTAL_EXPENDITURE,
      fiscalYear: fy,
      amountCents: all.totalExpenditureCents,
      sourceLabel: "ACFR FY2025 total governmental funds expenditure",
    },
    {
      entityId: ENTITY_FUND_BALANCE,
      fiscalYear: fy,
      amountCents: all.endingFundBalanceCents,
      sourceLabel: "ACFR FY2025 total governmental funds fund balance",
    },
    {
      entityId: ENTITY_GENERAL_FUND_REVENUE,
      fiscalYear: fy,
      amountCents: gf.totalRevenueCents,
      sourceLabel: "ACFR FY2025 General Fund revenue",
    },
    {
      entityId: ENTITY_GENERAL_FUND_EXPENDITURE,
      fiscalYear: fy,
      amountCents: gf.totalExpenditureCents,
      sourceLabel: "ACFR FY2025 General Fund expenditure",
    },
    {
      entityId: ENTITY_GENERAL_FUND_BALANCE,
      fiscalYear: fy,
      amountCents: gf.endingFundBalanceCents,
      sourceLabel: "ACFR FY2025 General Fund fund balance",
    },
  ];
}
