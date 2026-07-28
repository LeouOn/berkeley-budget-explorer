import cpiData from "../artifacts/cpi.json" with { type: "json" };
import entitiesData from "../artifacts/entities.json" with { type: "json" };
import overviewData from "../artifacts/overview.json" with { type: "json" };
import populationData from "../artifacts/population.json" with { type: "json" };
import releaseData from "../artifacts/release.json" with { type: "json" };
import valuesData from "../artifacts/values.json" with { type: "json" };
import { ReportIssue } from "../components/ReportIssue";
import { type ServiceEntry, getServiceByKey } from "../content/services";
import {
  Card,
  type DefinitionItem,
  DefinitionList,
  PageLayout,
  TrendChart,
} from "../design-system";
import type { BudgetValue, Entity } from "../pipeline/canonical/schema";
import type { OverviewSnapshot } from "../pipeline/derive/derive";
import type { FiscalYearAverage } from "../pipeline/sources/bls-cpi";
import { formatCents, getOverviewTrend } from "../query/engine";
import styles from "./Service.module.css";

interface CpiArtifact {
  readonly fiscalYearAverages: readonly FiscalYearAverage[];
}

const cpiAverages = (cpiData as CpiArtifact).fiscalYearAverages;
const values = valuesData as readonly BudgetValue[];
const entities = entitiesData as readonly Entity[];
const populationObs = (
  populationData as {
    readonly observations: readonly { fiscalYear: number; estimatedPopulation: number }[];
  }
).observations;
const overviewBundle = overviewData as {
  readonly baseYear: number;
  readonly snapshots: readonly OverviewSnapshot[];
};
const release = releaseData as {
  readonly releaseId: string;
  readonly generatedAt: string;
};

const BUDGET_GF_EXPENDITURE_ID = "ent-budget-fy2025-general-fund-expenditure";
const ACFR_GF_EXPENDITURE_ID = "ent-acfr-general-fund-expenditure";
const CITYWIDE_EXPENDITURE_ENTITY_ID = "ent-citywide-expenditure";

interface ServiceRouteProps {
  readonly serviceKey: string;
}

function socrataDepartmentEntityId(slug: string): string {
  return `ent-socrata-dept-${slug}`;
}

function compareByDepartmentHref(service: ServiceEntry): string | null {
  if (!service.socrataDepartmentKey) return null;
  return `#/compare?entities=${socrataDepartmentEntityId(service.socrataDepartmentKey)},ent-citywide-expenditure&start=2003&end=2024`;
}

function compareByCategoryHref(service: ServiceEntry): string | null {
  if (service.relatedExpenseCategoryIds.length === 0) return null;
  const ids = [...service.relatedExpenseCategoryIds, CITYWIDE_EXPENDITURE_ENTITY_ID].slice(0, 4);
  return `#/compare?entities=${ids.join(",")}&start=2003&end=2024`;
}

function relatedCategoryNames(service: ServiceEntry): readonly { id: string; name: string }[] {
  return service.relatedExpenseCategoryIds.map((id) => ({
    id,
    name: entities.find((e) => e.id === id)?.canonicalName ?? id,
  }));
}

interface VarianceCard {
  readonly adoptedCents: number;
  readonly actualCents: number;
  readonly deltaCents: number;
  readonly percent: number;
}

function generalFundVariance(): VarianceCard | null {
  const adopted = values.find(
    (v) => v.entityId === BUDGET_GF_EXPENDITURE_ID && v.stage === "adopted",
  );
  const actual = values.find((v) => v.entityId === ACFR_GF_EXPENDITURE_ID && v.stage === "actual");
  if (!adopted || !actual) return null;
  const deltaCents = actual.amountNominalCents - adopted.amountNominalCents;
  const percent =
    adopted.amountNominalCents > 0
      ? Math.round((deltaCents / adopted.amountNominalCents) * 1000) / 10
      : 0;
  return {
    adoptedCents: adopted.amountNominalCents,
    actualCents: actual.amountNominalCents,
    deltaCents,
    percent,
  };
}

function citywideTrendPoints(baseYear: number): {
  readonly points: readonly { fiscalYear: number; amountCents: number }[];
  readonly summary: string;
} {
  const snapshot = overviewBundle.snapshots.find((s) => s.fiscalYear === baseYear);
  if (!snapshot) return { points: [], summary: "No snapshot available." };
  const trend = getOverviewTrend({
    snapshot,
    values,
    entities,
    cpi: cpiAverages,
    population: populationObs,
    mode: "real",
    baseYear,
  });
  return {
    points: trend.map((p) => ({ fiscalYear: p.fiscalYear, amountCents: p.expendituresCents })),
    summary: `Citywide standardized expenditures FY2003-FY2024 in real (FY${baseYear}) dollars, from the SCO per-capita dataset. Service-level rollups are not available until Berkeley's adopted budgets publish program-level detail.`,
  };
}

export function Service({ serviceKey }: ServiceRouteProps): React.JSX.Element {
  const service = getServiceByKey(serviceKey);
  const baseYear = overviewBundle.baseYear;

  if (!service) {
    return (
      <PageLayout
        eyebrow="Service detail"
        title="Service not found"
        intro={`No service matches the key "${serviceKey}".`}
        footer={
          <>
            <small>
              Release {release.releaseId} generated {release.generatedAt}.
            </small>
            <ReportIssue />
          </>
        }
      >
        <p>
          <a href="#/">Back to the Overview</a>
        </p>
      </PageLayout>
    );
  }

  const trend = citywideTrendPoints(baseYear);
  const departmentHref = compareByDepartmentHref(service);
  const categoryHref = compareByCategoryHref(service);
  const categoryNames = relatedCategoryNames(service);
  const variance = service.serviceKey === "svc-general" ? generalFundVariance() : null;
  const varianceCardItems: DefinitionItem[] = variance
    ? [
        { term: "Adopted", description: formatCents(variance.adoptedCents) },
        { term: "Actual (ACFR)", description: formatCents(variance.actualCents) },
        {
          term: "Variance",
          description: `${formatCents(Math.abs(variance.deltaCents))} ${variance.deltaCents >= 0 ? "over" : "under"} (${Math.abs(variance.percent).toFixed(1)}%)`,
        },
      ]
    : [];

  return (
    <PageLayout
      eyebrow={service.serviceKey}
      title={service.label}
      intro={service.plainDescription}
      footer={
        <>
          <small>
            Release {release.releaseId}. Citywide trend uses SCO standardized actuals FY2003-FY2024.
          </small>
          <ReportIssue />
        </>
      }
    >
      <nav className={styles.navLinks} aria-label="Route navigation">
        <a href="#/">Overview</a>
        <span aria-hidden="true">·</span>
        <a href="#/compare">Compare budgets</a>
        <span aria-hidden="true">·</span>
        <a href="#/methodology">Methodology</a>
      </nav>

      <section aria-labelledby="trend-heading" className={styles.section}>
        <h2 id="trend-heading">Citywide expenditure trend</h2>
        <p className={styles.disclosure}>
          The City Controller does not publish a service-level expenditure series. The chart below
          shows the citywide total from the SCO per-capita dataset so this page never fabricates a
          department-level rollup.
        </p>
        {trend.points.length > 0 ? (
          <TrendChart
            points={trend.points}
            baseYear={baseYear}
            yLabel="Total citywide expenditures"
            ariaLabel={`Citywide standardized expenditures for ${service.label}, FY2003 to FY2024.`}
            summary={trend.summary}
          />
        ) : (
          <p>Citywide trend unavailable.</p>
        )}
      </section>

      {variance ? (
        <section aria-labelledby="variance-heading" className={styles.section}>
          <h2 id="variance-heading">Adopted vs Actual (FY2025 General Fund)</h2>
          <p className={styles.disclosure}>
            Only the General Fund has both an adopted budget and an audited actual for FY2025.
            Service-level variance is not available.
          </p>
          <Card
            eyebrow="FY2025 variance"
            title="General Fund: Adopted vs Actual"
            body={
              <DefinitionList ariaLabel="FY2025 General Fund variance" items={varianceCardItems} />
            }
            footer={
              <a
                href={`#/compare?entities=${BUDGET_GF_EXPENDITURE_ID},${ACFR_GF_EXPENDITURE_ID}&start=2025&end=2025`}
                className={styles.compareLink}
              >
                Open in Compare →
              </a>
            }
          />
        </section>
      ) : null}

      <section aria-labelledby="included-heading" className={styles.section}>
        <h2 id="included-heading">What&apos;s in this service?</h2>
        <p className={styles.disclosure}>
          Service-level line items are not published in a single Berkeley dataset. The closest SCO
          detailed expenditure categories are listed below — these are approximate mappings, not a
          1:1 service breakdown.
        </p>
        {categoryNames.length > 0 ? (
          <>
            <ul className={styles.categoryList}>
              {categoryNames.map((c) => (
                <li key={c.id} className={styles.categoryItem}>
                  <span className={styles.categoryName}>{c.name}</span>
                  <span className={styles.categoryId}>{c.id}</span>
                </li>
              ))}
            </ul>
            {categoryHref ? (
              <p>
                <a href={categoryHref} className={styles.compareLink}>
                  Compare these categories in Compare →
                </a>
              </p>
            ) : null}
          </>
        ) : (
          <p>
            No SCO detailed expenditure category maps cleanly to this service. The closest
            expenditures are scattered across multiple categories.
          </p>
        )}
        {departmentHref ? (
          <p>
            <a href={departmentHref} className={styles.compareLink}>
              Compare the primary department ({service.label}) in Compare →
            </a>
          </p>
        ) : (
          <p className={styles.muted}>
            No single primary Socrata department is mapped to this service.
          </p>
        )}
      </section>

      <section aria-labelledby="excluded-heading" className={styles.section}>
        <h2 id="excluded-heading">What&apos;s not in this service?</h2>
        <p className={styles.warn}>
          The SCO detailed expenditure schema changes materially in FY2017, and the Berkeley Socrata
          line-item cohort stops at FY2015. Neither break is stitched into the citywide series. Any
          category-level comparison across FY2017 or any department-level comparison before FY2012
          is approximate.
        </p>
      </section>
    </PageLayout>
  );
}
