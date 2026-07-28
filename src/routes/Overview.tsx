import cpiData from "../artifacts/cpi.json" with { type: "json" };
import entitiesData from "../artifacts/entities.json" with { type: "json" };
import overviewData from "../artifacts/overview.json" with { type: "json" };
import populationData from "../artifacts/population.json" with { type: "json" };
import releaseData from "../artifacts/release.json" with { type: "json" };
import valuesData from "../artifacts/values.json" with { type: "json" };
import { serviceTaxonomy } from "../content/services";
import {
  Card,
  type Column,
  DataTable,
  DefinitionList,
  PageLayout,
  Toggle,
  type ToggleOption,
  TrendChart,
} from "../design-system";
import type { BudgetValue, Entity } from "../pipeline/canonical/schema";
import type { OverviewSnapshot } from "../pipeline/derive/derive";
import type { OverviewInsight } from "../pipeline/derive/insights";
import type { FiscalYearAverage } from "../pipeline/sources/bls-cpi";
import { type DollarMode, formatCents, getOverviewTrend } from "../query/engine";
import styles from "./Overview.module.css";
import { OverviewInsights } from "./OverviewInsights";
import { useOverviewUrlState } from "./overview-url-state";

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
  readonly insights?: readonly OverviewInsight[];
};
const release = releaseData as {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly sources: readonly string[];
};

const TOP_DEPARTMENT_ENTITY_IDS = [
  "ent-socrata-dept-police",
  "ent-socrata-dept-fire",
  "ent-socrata-dept-public-works",
  "ent-socrata-dept-parks",
] as const;
const compareByDepartmentHref = `#/compare?entities=${TOP_DEPARTMENT_ENTITY_IDS.join(",")}&start=2012&end=2015`;

const modeOptions: readonly ToggleOption<DollarMode>[] = [
  { value: "real", label: "Real (FY2024 dollars)" },
  { value: "nominal", label: "Nominal" },
];

export function Overview(): React.JSX.Element {
  const { mode, setMode } = useOverviewUrlState();
  const baseYear = overviewBundle.baseYear;
  const currentSnapshot =
    overviewBundle.snapshots.find((s) => s.fiscalYear === baseYear) ?? overviewBundle.snapshots[0];
  const anchorSnapshot = overviewBundle.snapshots.find((s) => s.fiscalYear === 2015);
  if (!currentSnapshot) throw new Error("No overview snapshot available");
  const trend = getOverviewTrend({
    snapshot: currentSnapshot,
    values,
    entities,
    cpi: cpiAverages,
    population: populationObs,
    mode,
    baseYear,
  });
  const summary =
    mode === "real"
      ? `Total expenditures and revenues scaled to FY${baseYear} dollars using BLS CPI-U for San Francisco-Oakland-Hayward.`
      : "Total expenditures and revenues as reported in nominal dollars.";
  const tableColumns: readonly Column<(typeof trend)[number]>[] = [
    { key: "year", header: "Fiscal year", render: (r) => `FY${r.fiscalYear}` },
    {
      key: "exp",
      header: "Total expenditures",
      align: "end",
      render: (r) => formatCents(r.expendituresCents),
    },
    {
      key: "rev",
      header: "Total revenues",
      align: "end",
      render: (r) => formatCents(r.revenuesCents),
    },
    {
      key: "pcExp",
      header: "Per-resident expenditures",
      align: "end",
      render: (r) => formatCents(r.perResidentExpendituresCents),
    },
    {
      key: "pcRev",
      header: "Per-resident revenues",
      align: "end",
      render: (r) => formatCents(r.perResidentRevenuesCents),
    },
    { key: "comp", header: "Comparability", render: (r) => r.comparability },
  ];
  return (
    <PageLayout
      eyebrow="Berkeley Budget Explorer"
      title="City of Berkeley at a glance"
      intro="Inflation-adjusted dollars by default, with a toggle for nominal amounts. Every figure links to one of five published sources."
      footer={
        <small>
          Release {release.releaseId} generated {release.generatedAt}. Phase 1 surface: California
          State Controller standardized actuals for Berkeley (FY2003–FY2024). Adopted-versus-actual
          variance is deferred to Phase 3.
        </small>
      }
    >
      <nav className={styles.navLinks} aria-label="Route navigation">
        <a href="#/compare" className={styles.compareCta}>
          Compare budgets →
        </a>
        <a href="#/quality">Quality</a>
        <a href="#/methodology">Methodology</a>
      </nav>

      <section aria-labelledby="disclosure-heading" className={styles.section}>
        <h2 id="disclosure-heading">What this page shows</h2>
        <p>
          Every value on this page is a California State Controller{" "}
          <strong>standardized actual</strong> for the City of Berkeley, drawn from the per-capita
          datasets <code>src-sco-expenditures-per-capita-ykhf-vfsr</code> and{" "}
          <code>src-sco-revenues-per-capita-ky7j-fsk5</code>. Adopted, revised, and projected values
          are not shown. Adopted-versus-actual variance is deferred to Phase 3.
        </p>
      </section>

      <section aria-labelledby="snapshot-heading" className={styles.section}>
        <h2 id="snapshot-heading">Fiscal snapshot</h2>
        <DefinitionList
          ariaLabel="Latest fiscal snapshot"
          items={[
            { term: "Selected fiscal year", description: `FY${currentSnapshot.fiscalYear}` },
            {
              term: "Total expenditures",
              description: formatCents(currentSnapshot.expendituresCents),
            },
            { term: "Total revenues", description: formatCents(currentSnapshot.revenuesCents) },
            {
              term: "Per-resident expenditures",
              description: `${formatCents(currentSnapshot.perResidentExpendituresCents)} (population ${currentSnapshot.estimatedPopulation.toLocaleString("en-US")})`,
            },
            {
              term: "Per-resident revenues",
              description: formatCents(currentSnapshot.perResidentRevenuesCents),
            },
            { term: "Comparability", description: currentSnapshot.comparability },
            { term: "Sources", description: currentSnapshot.sources.join(", ") },
          ]}
        />
      </section>

      <section aria-labelledby="toggle-heading" className={styles.section}>
        <div className={styles.toggleRow}>
          <Toggle legend="Dollar mode" options={modeOptions} value={mode} onChange={setMode} />
          <p className={styles.toggleMeta}>
            Showing {mode === "real" ? `inflation-adjusted (base FY${baseYear})` : "as-reported"}{" "}
            dollars.
          </p>
        </div>
      </section>

      <section aria-labelledby="trend-heading" className={styles.section}>
        <h2 id="trend-heading">Historical trend</h2>
        <TrendChart
          points={trend.map((p) => ({
            fiscalYear: p.fiscalYear,
            amountCents: p.expendituresCents,
          }))}
          baseYear={baseYear}
          yLabel="Total expenditures"
          ariaLabel="Total citywide standardized expenditures by fiscal year."
          summary={summary}
        />
        <DataTable
          caption="Total standardized expenditures and revenues by fiscal year, with per-resident values (synchronized with the chart above)."
          columns={tableColumns}
          rows={trend}
          getRowKey={(r) => String(r.fiscalYear)}
        />
      </section>

      <OverviewInsights insights={overviewBundle.insights ?? []} />

      <section aria-labelledby="services-heading" className={styles.section}>
        <h2 id="services-heading">Service areas</h2>
        <p>
          The Socrata operating-budget cohort (<code>gy8t-iqc4</code>) publishes adopted
          department-level budgets for FY2012–FY2015. FY2015 marks the end of that cohort; it is
          never stitched into the SCO actuals series. Select a service to see its detail page.
        </p>
        <div className={styles.cardGrid}>
          {serviceTaxonomy.map((svc) => (
            <Card
              key={svc.serviceKey}
              eyebrow={svc.serviceKey}
              title={svc.label}
              body={<p>{svc.plainDescription}</p>}
              footer={
                <div className={styles.cardFooterRow}>
                  {svc.socrataProgramKey ? (
                    <small>Indexed in Socrata cohort as &quot;{svc.socrataProgramKey}&quot;.</small>
                  ) : (
                    <small>Citywide total only in Phase 1.</small>
                  )}
                  <a
                    href={`#/service/${svc.serviceKey}`}
                    className={styles.compareDeptLink}
                    aria-label={`Open ${svc.label} service detail`}
                  >
                    Service detail →
                  </a>
                </div>
              }
            />
          ))}
        </div>
        <p>
          <a href={compareByDepartmentHref} className={styles.compareDeptLink}>
            Compare Police, Fire, Public Works &amp; Parks by department →
          </a>
        </p>
      </section>

      <section aria-labelledby="revenue-heading" className={styles.section}>
        <h2 id="revenue-heading">Citywide revenue context</h2>
        <p>
          The SCO revenues per-capita dataset (<code>ky7j-fsk5</code>) publishes Berkeley&apos;s
          citywide revenue total FY2003–FY2024. Sub-category breakdowns (property tax, sales tax,
          transfers) are not available from this source; the FY2025 ACFR adds category-level detail
          for a single year only. Open Compare to track total revenue against total expenditure
          across the full series.
        </p>
        <p>
          <a
            href="#/compare?entities=ent-citywide-revenue,ent-citywide-expenditure&start=2003&end=2024"
            className={styles.compareDeptLink}
          >
            Compare citywide revenue vs expenditure →
          </a>
        </p>
      </section>

      {anchorSnapshot ? (
        <section aria-labelledby="break-heading" className={styles.section}>
          <h2 id="break-heading">Known schema breaks</h2>
          <p className={styles.warn}>
            The Socrata operating-budget line items stop at FY{anchorSnapshot.fiscalYear}. The State
            Controller&apos;s detailed expenditure schema changes materially in FY2017. Phase 1
            shows the citywide total across both sources without implying false line-item continuity
            across either break.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="sources-heading" className={styles.section}>
        <h2 id="sources-heading">Source citations</h2>
        <ul className={styles.citationList}>
          {release.sources.map((id) => (
            <li key={id} className={styles.citationItem}>
              <span className={styles.citationId}>{id}</span>
              <span>
                Source manifest entry {id}; see <a href="#/methodology">Methodology</a>.
              </span>
            </li>
          ))}
        </ul>
      </section>
    </PageLayout>
  );
}
