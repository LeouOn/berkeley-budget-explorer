import type { BudgetValue, Entity } from "../canonical/schema";
import { type FiscalYearAverage, inflateCents } from "../sources/bls-cpi";

export interface OverviewInsight {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly linkToCompare?: readonly string[];
}

export interface BuildInsightsInput {
  readonly values: readonly BudgetValue[];
  readonly entities: readonly Entity[];
  readonly cpi: readonly FiscalYearAverage[];
  readonly baseYear: number;
}

const SCHEMA_BREAK_YEAR = 2017;
const GROWTH_WINDOW_START = 2003;
const GROWTH_WINDOW_END = 2024;
const GROWTH_MIN_SPAN_YEARS = 5;
const BLS_MIN_OBSERVATIONS = 6;

const BUDGET_GF_EXPENDITURE_ID = "ent-budget-fy2025-general-fund-expenditure";
const ACFR_GF_EXPENDITURE_ID = "ent-acfr-general-fund-expenditure";

function hasBlsCoverage(cpi: readonly FiscalYearAverage[], fiscalYear: number): boolean {
  const entry = cpi.find((a) => a.fiscalYear === fiscalYear);
  return entry !== undefined && entry.observationCount >= BLS_MIN_OBSERVATIONS;
}

interface RealGrowthCandidate {
  readonly entityId: string;
  readonly entityName: string;
  readonly startYear: number;
  readonly endYear: number;
  readonly startRealCents: number;
  readonly endRealCents: number;
  readonly percentChange: number;
}

function computeRealGrowthCandidates(
  values: readonly BudgetValue[],
  entities: readonly Entity[],
  cpi: readonly FiscalYearAverage[],
  baseYear: number,
): readonly RealGrowthCandidate[] {
  const nameById = new Map<string, string>();
  for (const e of entities) nameById.set(e.id, e.canonicalName);

  const byEntity = new Map<string, BudgetValue[]>();
  for (const v of values) {
    if (v.entityType !== "expense-category") continue;
    if (v.fiscalYear < GROWTH_WINDOW_START || v.fiscalYear > GROWTH_WINDOW_END) continue;
    const list = byEntity.get(v.entityId) ?? [];
    list.push(v);
    byEntity.set(v.entityId, list);
  }

  const candidates: RealGrowthCandidate[] = [];
  for (const [entityId, entityValues] of byEntity) {
    const sorted = [...entityValues].sort((a, b) => a.fiscalYear - b.fiscalYear);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) continue;
    if (last.fiscalYear - first.fiscalYear < GROWTH_MIN_SPAN_YEARS) continue;
    if (first.amountNominalCents <= 0) continue;
    if (!hasBlsCoverage(cpi, first.fiscalYear) || !hasBlsCoverage(cpi, last.fiscalYear)) continue;
    const startReal = inflateCents(first.amountNominalCents, first.fiscalYear, baseYear, cpi);
    const endReal = inflateCents(last.amountNominalCents, last.fiscalYear, baseYear, cpi);
    const percentChange = Math.round(((endReal - startReal) / startReal) * 1000) / 10;
    candidates.push({
      entityId,
      entityName: nameById.get(entityId) ?? entityId,
      startYear: first.fiscalYear,
      endYear: last.fiscalYear,
      startRealCents: startReal,
      endRealCents: endReal,
      percentChange,
    });
  }
  return candidates;
}

function buildLargestGrowthInsight(
  values: readonly BudgetValue[],
  entities: readonly Entity[],
  cpi: readonly FiscalYearAverage[],
  baseYear: number,
): OverviewInsight | null {
  const candidates = computeRealGrowthCandidates(values, entities, cpi, baseYear);
  if (candidates.length === 0) return null;
  const top = candidates.reduce((best, c) => (c.percentChange > best.percentChange ? c : best));
  if (top.percentChange <= 0) return null;
  const pctLabel = `${top.percentChange.toFixed(1)}%`;
  const body =
    `${top.entityName} grew ${pctLabel} in real (FY${baseYear}) dollars from FY${top.startYear} ` +
    `to FY${top.endYear} — the largest real-dollar increase among SCO detailed categories.`;
  return {
    id: "largest-real-growth",
    title: "Largest real-dollar growth",
    body,
    linkToCompare: [top.entityId],
  };
}

function buildAdoptedVsActualInsight(values: readonly BudgetValue[]): OverviewInsight | null {
  const adopted = values.find(
    (v) => v.entityId === BUDGET_GF_EXPENDITURE_ID && v.stage === "adopted",
  );
  const actual = values.find((v) => v.entityId === ACFR_GF_EXPENDITURE_ID && v.stage === "actual");
  if (!adopted || !actual) return null;
  const deltaCents = actual.amountNominalCents - adopted.amountNominalCents;
  const pct =
    adopted.amountNominalCents > 0
      ? Math.round((deltaCents / adopted.amountNominalCents) * 1000) / 10
      : 0;
  const toMillions = (cents: number): string => (cents / 100_000_000).toFixed(1);
  const direction = deltaCents >= 0 ? "more" : "less";
  const body =
    `FY2025 General Fund: adopted $${toMillions(adopted.amountNominalCents)}M, ` +
    `actual $${toMillions(actual.amountNominalCents)}M. ` +
    `Spent $${toMillions(Math.abs(deltaCents))}M (${Math.abs(pct).toFixed(1)}%) ${direction} than adopted.`;
  return {
    id: "general-fund-adopted-vs-actual",
    title: "General Fund: Adopted vs Actual",
    body,
    linkToCompare: [BUDGET_GF_EXPENDITURE_ID, ACFR_GF_EXPENDITURE_ID],
  };
}

const BHIST_TOTAL_EXPENDITURE_ID = "ent-bhist-exp-total-expenditures";

function buildFY2024VarianceInsight(values: readonly BudgetValue[]): OverviewInsight | null {
  const adopted = values.find(
    (v) =>
      v.entityId === BHIST_TOTAL_EXPENDITURE_ID && v.fiscalYear === 2024 && v.stage === "adopted",
  );
  const projected = values.find(
    (v) =>
      v.entityId === BHIST_TOTAL_EXPENDITURE_ID && v.fiscalYear === 2024 && v.stage === "projected",
  );
  if (!adopted || !projected) return null;
  const deltaCents = projected.amountNominalCents - adopted.amountNominalCents;
  const pct =
    adopted.amountNominalCents > 0
      ? Math.round((deltaCents / adopted.amountNominalCents) * 1000) / 10
      : 0;
  const toMillions = (cents: number): string => (cents / 100_000_000).toFixed(1);
  const direction = deltaCents >= 0 ? "more" : "less";
  const body = `FY2024 total expenditures: budgeted $${toMillions(adopted.amountNominalCents)}M, estimated actual $${toMillions(projected.amountNominalCents)}M. Tracking $${toMillions(Math.abs(deltaCents))}M (${Math.abs(pct).toFixed(1)}%) ${direction} than budgeted (budget-book estimate; audited actuals pending).`;
  return {
    id: "fy2024-budget-variance",
    title: "FY2024: Budget vs Estimated Actual",
    body,
    linkToCompare: [BHIST_TOTAL_EXPENDITURE_ID],
  };
}

function buildSchemaReorganizationInsight(values: readonly BudgetValue[]): OverviewInsight | null {
  const pre = new Set<string>();
  const post = new Set<string>();
  for (const v of values) {
    if (v.entityType !== "expense-category") continue;
    if (v.fiscalYear < SCHEMA_BREAK_YEAR) pre.add(v.entityId);
    else if (!pre.has(v.entityId)) post.add(v.entityId);
  }
  if (pre.size === 0 || post.size === 0) return null;
  const body = `${pre.size} expenditure categories before FY${SCHEMA_BREAK_YEAR} became ${post.size} new categories post-FY${SCHEMA_BREAK_YEAR}. Comparisons across this boundary are approximate.`;
  return {
    id: "schema-reorganization",
    title: "Schema reorganization",
    body,
  };
}

export function buildOverviewInsights(input: BuildInsightsInput): readonly OverviewInsight[] {
  const { values, entities, cpi, baseYear } = input;
  const insights: OverviewInsight[] = [];
  const schema = buildSchemaReorganizationInsight(values);
  if (schema) insights.push(schema);
  const growth = buildLargestGrowthInsight(values, entities, cpi, baseYear);
  if (growth) insights.push(growth);
  const variance = buildAdoptedVsActualInsight(values);
  if (variance) insights.push(variance);
  const fy2024Variance = buildFY2024VarianceInsight(values);
  if (fy2024Variance) insights.push(fy2024Variance);
  return insights;
}
