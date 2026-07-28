import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadVerifiedSnapshot, loadVerifiedSource, requireEntry } from "./build-helpers";
import {
  buildAcfrEntities,
  buildCitywideEntities,
  buildScoCategoryEntities,
  normalizeAcfrGovernmentalFunds,
  normalizeScoDetailedCategories,
  normalizeScoExpenditurePerCapita,
  normalizeScoRevenuePerCapita,
  normalizeSocrata,
} from "./canonical/normalize";
import { buildBudgetEntities, normalizeBudgetAdopted } from "./canonical/normalize-budget";
import {
  buildRevenueCategoryEntities,
  normalizeRevenueBudget,
} from "./canonical/normalize-revenue-budget";
import type { BudgetValue, Entity } from "./canonical/schema";
import { writeArtifact, writeArtifacts } from "./derive/artifacts";
import { buildOverviewSnapshot } from "./derive/derive";
import { type OverviewInsight, buildOverviewInsights } from "./derive/insights";
import { writeQualityReport } from "./derive/quality-report";
import {
  reconcileBlsCoverage,
  reconcileScoPerCapita,
  reconcileSocrataCohort,
  runAllReconciliations,
} from "./reconcile/reconcile";
import {
  parseAcfrFy2025Snapshot,
  toAcfrGovernmentalFundsRecords,
} from "./sources/acfr-transcription";
import { assertCohortSealed, groupByService, parseSocrataRows } from "./sources/berkeley-socrata";
import {
  MIN_COVERAGE,
  fiscalYearAverage,
  latestCompleteFiscalYear,
  loadBlsFromSnapshot,
} from "./sources/bls-cpi";
import { parseBudgetFy2025Snapshot, toBudgetAdoptedRecords } from "./sources/budget-transcription";
import { SourceManifestSchema } from "./sources/manifest";
import manifestData from "./sources/manifest.data.json" with { type: "json" };
import { POPULATION_SUPPLEMENTS } from "./sources/population-supplement";
import {
  parseRevenueBudgetFy2025Snapshot,
  toRevenueBudgetRecords,
} from "./sources/revenue-budget-transcription";
import { parseScoDetailed, summarizeCategoriesByFiscalYear } from "./sources/sco-detailed";
import {
  citywideTrend,
  crossCheckInternal,
  filterBerkeley,
  parseScoExpenditurePerCapita,
  parseScoRevenuePerCapita,
} from "./sources/sco-per-capita";
import { normalizeSocrataDepartments } from "./sources/socrata-departments";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_ROOT = resolve(__dirname, "../../data/snapshots");
const artifactsDir = resolve(__dirname, "../artifacts");
const SCHEMA_VERSION = "1.0.0";
const SOCRATA_COHORT_START = 2012;
const SOCRATA_COHORT_END = 2015;

const entities: readonly Entity[] = buildCitywideEntities();

function countByStage(values: readonly BudgetValue[]) {
  const acc = { adopted: 0, actual: 0, projected: 0, revised: 0, proposed: 0 };
  for (const v of values) acc[v.stage] += 1;
  return acc;
}

export async function buildArtifacts(): Promise<void> {
  mkdirSync(artifactsDir, { recursive: true });
  const manifest = SourceManifestSchema.parse(manifestData);
  const releaseId = manifest.releaseId;

  const blsEntry = requireEntry("src-bls-cpi-u-cuura422sa0");
  const socrataEntry = requireEntry("src-berkeley-socrata-gy8t-iqc4");
  const detailedEntry = requireEntry("src-sco-expenditures-ju3w-4gxp");
  const expPcEntry = requireEntry("src-sco-expenditures-per-capita-ykhf-vfsr");
  const revPcEntry = requireEntry("src-sco-revenues-per-capita-ky7j-fsk5");
  const acfrEntry = requireEntry("src-acfr-fy2025");
  const budgetEntry = requireEntry("src-budget-fy2025");
  const revenueBudgetEntry = requireEntry("src-revenue-budget-fy2025");

  const blsObservations = await loadBlsFromSnapshot(SNAPSHOT_ROOT, releaseId);
  const socrataRaw = loadVerifiedSource(SNAPSHOT_ROOT, socrataEntry, releaseId);
  const detailedRaw = loadVerifiedSource(SNAPSHOT_ROOT, detailedEntry, releaseId);
  const expPcRaw = loadVerifiedSource(SNAPSHOT_ROOT, expPcEntry, releaseId);
  const revPcRaw = loadVerifiedSource(SNAPSHOT_ROOT, revPcEntry, releaseId);
  const acfrSnapshot = parseAcfrFy2025Snapshot(
    loadVerifiedSnapshot(SNAPSHOT_ROOT, acfrEntry, releaseId),
  );
  const budgetSnapshot = parseBudgetFy2025Snapshot(
    loadVerifiedSnapshot(SNAPSHOT_ROOT, budgetEntry, releaseId),
  );
  const revenueBudgetSnapshot = parseRevenueBudgetFy2025Snapshot(
    loadVerifiedSnapshot(SNAPSHOT_ROOT, revenueBudgetEntry, releaseId),
  );

  const socrataRows = parseSocrataRows(socrataRaw);
  assertCohortSealed(socrataRows, SOCRATA_COHORT_START, SOCRATA_COHORT_END);
  const detailedRows = filterBerkeley(parseScoDetailed(detailedRaw));
  const expPcRows = filterBerkeley(parseScoExpenditurePerCapita(expPcRaw));
  const revPcRows = filterBerkeley(parseScoRevenuePerCapita(revPcRaw));
  crossCheckInternal(expPcRows, 50);

  const trend = citywideTrend(expPcRows, revPcRows);
  const population = trend.map((t) => ({
    fiscalYear: t.fiscalYear,
    estimatedPopulation: t.estimatedPopulation,
  }));
  const populationByYear = new Map(population.map((p) => [p.fiscalYear, p.estimatedPopulation]));
  for (const supplement of POPULATION_SUPPLEMENTS) {
    if (!populationByYear.has(supplement.fiscalYear)) {
      population.push({
        fiscalYear: supplement.fiscalYear,
        estimatedPopulation: supplement.estimatedPopulation,
      });
      populationByYear.set(supplement.fiscalYear, supplement.estimatedPopulation);
    }
  }
  population.sort((a, b) => a.fiscalYear - b.fiscalYear);

  const socrataValues = normalizeSocrata(socrataRows, "src-berkeley-socrata-gy8t-iqc4");
  const socrataDepartments = normalizeSocrataDepartments(socrataRows, socrataEntry.id);
  const socrataServiceGroups = groupByService(socrataRows).map((g) => ({
    serviceKey: g.serviceKey,
    totalCents: g.totalCents,
    rowCount: g.rowCount,
  }));
  const expValues = normalizeScoExpenditurePerCapita(expPcRows, expPcEntry.id);
  const revValues = normalizeScoRevenuePerCapita(revPcRows, revPcEntry.id);
  const categorySummaries = summarizeCategoriesByFiscalYear(detailedRows);
  const categoryValues = normalizeScoDetailedCategories(categorySummaries, detailedEntry.id);
  const categoryEntities = buildScoCategoryEntities(categorySummaries);
  const acfrRecords = toAcfrGovernmentalFundsRecords(acfrSnapshot);
  const acfrValues = normalizeAcfrGovernmentalFunds(acfrRecords, acfrEntry.id);
  const acfrEntities = buildAcfrEntities();
  const budgetRecords = toBudgetAdoptedRecords(budgetSnapshot);
  const budgetValues = normalizeBudgetAdopted(budgetRecords, budgetEntry.id);
  const budgetEntities = buildBudgetEntities();
  const revenueBudgetRecords = toRevenueBudgetRecords(revenueBudgetSnapshot);
  const revenueBudgetValues = normalizeRevenueBudget(revenueBudgetRecords, revenueBudgetEntry.id);
  const revenueCategoryEntities = buildRevenueCategoryEntities();
  const allEntities: readonly Entity[] = [
    ...entities,
    ...categoryEntities,
    ...acfrEntities,
    ...budgetEntities,
    ...revenueCategoryEntities,
    ...socrataDepartments.entities,
  ];
  const allValues: readonly BudgetValue[] = [
    ...expValues,
    ...revValues,
    ...socrataValues,
    ...socrataDepartments.values,
    ...acfrValues,
    ...budgetValues,
    ...revenueBudgetValues,
  ];
  const canonicalValues: readonly BudgetValue[] = [
    ...expValues,
    ...revValues,
    ...categoryValues,
    ...acfrValues,
    ...budgetValues,
    ...revenueBudgetValues,
    ...socrataDepartments.values,
  ];

  const cpiAveragesAll = fiscalYearAverage(blsObservations);
  const cpiAverages = cpiAveragesAll.filter((a) => a.observationCount >= MIN_COVERAGE);
  const reconSco = reconcileScoPerCapita(expPcRows);
  const reconBls = reconcileBlsCoverage(cpiAverages);
  const reconSocrata = reconcileSocrataCohort(
    socrataRows,
    SOCRATA_COHORT_START,
    SOCRATA_COHORT_END,
  );
  const allRecon = runAllReconciliations({
    perCapitaRows: expPcRows,
    blsAverages: cpiAverages,
    socrataRows,
    socrataFyStart: SOCRATA_COHORT_START,
    socrataFyEnd: SOCRATA_COHORT_END,
  });
  if (!allRecon.ok) {
    throw new Error(`Reconciliation failed: ${JSON.stringify(allRecon.mismatches)}`);
  }

  const latestBlsYear = latestCompleteFiscalYear(cpiAverages, MIN_COVERAGE);
  const latestScoYear = Math.max(...trend.map((t) => t.fiscalYear));
  const baseYear = Math.min(latestBlsYear, latestScoYear);
  const overviewCurrent = buildOverviewSnapshot({
    values: allValues,
    entities,
    cpi: cpiAverages,
    population,
    targetFiscalYear: baseYear,
    mode: "real",
    baseYear,
  });
  const overviewAnchor = buildOverviewSnapshot({
    values: allValues,
    entities,
    cpi: cpiAverages,
    population,
    targetFiscalYear: 2015,
    mode: "real",
    baseYear,
  });
  const insights: readonly OverviewInsight[] = buildOverviewInsights({
    values: canonicalValues,
    entities: allEntities,
    cpi: cpiAverages,
    baseYear,
  });

  writeArtifacts(artifactsDir, {
    release: {
      schemaVersion: SCHEMA_VERSION,
      releaseId,
      generatedAt: new Date().toISOString(),
      sources: manifest.sources.map((s) => s.id),
      surface: "sco-standardized-actuals",
    },
    values: canonicalValues,
    entities: allEntities,
    cpi: {
      schemaVersion: SCHEMA_VERSION,
      seriesId: "CUURA422SA0",
      baseYear,
      fiscalYearAverages: cpiAverages,
    },
    population: { schemaVersion: SCHEMA_VERSION, observations: population },
    overview: {
      schemaVersion: SCHEMA_VERSION,
      baseYear,
      surface: "sco-standardized-actuals",
      snapshots: [overviewCurrent, overviewAnchor],
      insights,
    },
    scoPerCapita: {
      schemaVersion: SCHEMA_VERSION,
      expenditureTrendCents: trend.map((t) => ({
        fiscalYear: t.fiscalYear,
        expendituresCents: t.expendituresCents,
        perResidentExpendituresCents: t.perResidentExpendituresCents,
        estimatedPopulation: t.estimatedPopulation,
      })),
      revenueTrendCents: trend.map((t) => ({
        fiscalYear: t.fiscalYear,
        revenuesCents: t.revenuesCents,
        perResidentRevenuesCents: t.perResidentRevenuesCents,
        estimatedPopulation: t.estimatedPopulation,
      })),
    },
    scoDetailedContext: {
      schemaVersion: SCHEMA_VERSION,
      surface: "category-context-only",
      schemaBreak:
        "SCO detailed expenditure schema changes materially in FY2017; citywide totals remain comparable across the break but per-line trends do not.",
      sampleBerkeley: detailedRows.slice(0, 50).map((r) => ({
        fiscalYear: r.fiscalYear,
        category: r.category,
        subcategory1: r.subcategory1,
        subcategory2: r.subcategory2,
        lineDescription: r.lineDescription,
        valueCents: r.valueCents,
      })),
    },
    socrataCohort: {
      schemaVersion: SCHEMA_VERSION,
      cohortStart: SOCRATA_COHORT_START,
      cohortEnd: SOCRATA_COHORT_END,
      surface: "sealed-cohort-do-not-stitch",
      totalLineItems: socrataValues.length,
      serviceGroups: socrataServiceGroups,
    },
  });

  writeQualityReport(artifactsDir, {
    releaseId,
    generatedAt: new Date().toISOString(),
    sourceCount: manifest.sources.length,
    sourceIds: manifest.sources.map((s) => s.id),
    normalizationCounts: countByStage(allValues),
    reconciliation: [
      { sourceId: expPcEntry.id, result: reconSco },
      { sourceId: blsEntry.id, result: reconBls },
      { sourceId: socrataEntry.id, result: reconSocrata },
    ],
    comparabilityNotes: [
      "Socrata cohort stops at FY2015; do not stitch into State Controller series.",
      "SCO detailed expenditure schema changes materially in FY2017; citywide totals remain comparable.",
      "Phase 1 surface is SCO standardized actuals for Berkeley; adopted-versus-actual variance is deferred to Phase 3.",
      "ACFR FY2025 governmental funds actuals are modified-accrual; they are a subset of citywide totals and are not comparable on a like-for-like basis with enterprise funds.",
      "Socrata department-level values are adopted budgets (budgetary basis, FY2012-FY2015) aggregated from line items; they are not comparable like-for-like with SCO per-capita actuals (GAAP basis).",
      "Revenue sub-category data is only available for FY2025 (adopted budget). For historical revenue trends, use citywide revenue.",
    ],
  });

  writeArtifact(artifactsDir, "build-status.json", { ok: true, baseYear, releaseId });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  buildArtifacts().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
