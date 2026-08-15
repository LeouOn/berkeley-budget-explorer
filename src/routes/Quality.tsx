import entitiesData from "../artifacts/entities.json" with { type: "json" };
import qualityReportData from "../artifacts/quality-report.json" with { type: "json" };
import releaseData from "../artifacts/release.json" with { type: "json" };
import valuesData from "../artifacts/values.json" with { type: "json" };
import { ReportIssue } from "../components/ReportIssue";
import { type Column, DataTable, DefinitionList, PageLayout, Sparkline } from "../design-system";
import type { BudgetValue, Entity } from "../pipeline/canonical/schema";
import type { QualityReport } from "../pipeline/derive/quality-report";
import type { SourceManifest } from "../pipeline/sources/manifest";
import manifestData from "../pipeline/sources/manifest.data.json" with { type: "json" };
import styles from "./Quality.module.css";
import { type ComparabilityGapGroup, type QualityData, buildQualityData } from "./quality-data";

const manifest = manifestData as SourceManifest;
const quality = qualityReportData as QualityReport;
const values = valuesData as readonly BudgetValue[];
const entities = entitiesData as readonly Entity[];
const release = releaseData as { readonly releaseId: string; readonly generatedAt: string };

const data: QualityData = buildQualityData({ manifest, values, entities, quality });

const coverageColumns: readonly Column<(typeof data.coverageRows)[number]>[] = [
  { key: "source", header: "Source", render: (r) => r.sourceId },
  {
    key: "trend",
    header: "Trend",
    render: (row: (typeof data.coverageRows)[number]) => {
      const points = row.cells
        .filter((c) => c.covered)
        .map((c) => ({ x: c.fiscalYear, y: c.valueCount }));
      if (points.length === 0) {
        return <span className={styles.miss}>—</span>;
      }
      return (
        <Sparkline
          points={points}
          ariaLabel={`Value count trend for ${row.sourceId}, ${points.length} covered fiscal years`}
        />
      );
    },
  },
  ...data.fiscalYears.map((fy) => ({
    key: `fy-${fy}`,
    header: `FY${fy}`,
    align: "end" as const,
    render: (row: (typeof data.coverageRows)[number]) => {
      const cell = row.cells.find((c) => c.fiscalYear === fy);
      if (!cell || !cell.covered)
        return (
          <span className={styles.miss} aria-label={`No data FY${fy}`}>
            —
          </span>
        );
      return <span className={styles.hit}>{cell.valueCount}</span>;
    },
  })),
];

const freshnessColumns: readonly Column<(typeof data.freshness)[number]>[] = [
  { key: "id", header: "Source", render: (r) => r.sourceId },
  { key: "date", header: "Retrieved", align: "end", render: (r) => r.retrievedAt },
];

const SHORT_SOURCE_NAMES: Record<string, string> = {
  "src-sco-expenditures-per-capita-ykhf-vfsr": "SCO exp/cap",
  "src-sco-revenues-per-capita-ky7j-fsk5": "SCO rev/cap",
  "src-sco-expenditures-ju3w-4gxp": "SCO detail",
  "src-berkeley-socrata-gy8t-iqc4": "Socrata depts",
  "src-bls-cpi-u-cuura422sa0": "BLS CPI",
  "src-acfr-fy2025": "ACFR FY25",
  "src-budget-fy2025": "Budget FY25",
  "src-revenue-budget-fy2025": "Rev cats FY25",
  "src-budget-history": "History FY22–26",
};

function shortSourceName(sourceId: string): string {
  return SHORT_SOURCE_NAMES[sourceId] ?? sourceId;
}

const reconciliationColumns: readonly Column<(typeof data.reconciliation)[number]>[] = [
  { key: "id", header: "Source", render: (r) => shortSourceName(r.sourceId) },
  { key: "status", header: "Reconciliation", align: "end", render: (r) => r.status },
];

const presenceColumns: readonly Column<(typeof data.yearPresenceRows)[number]>[] = [
  { key: "fy", header: "Fiscal year", render: (r) => `FY${r.fiscalYear}` },
  ...data.presenceSourceIds.map((sourceId) => ({
    key: `src-${sourceId}`,
    header: shortSourceName(sourceId),
    align: "end" as const,
    render: (row: (typeof data.yearPresenceRows)[number]) => {
      const cell = row.cells.find((c) => c.sourceId === sourceId);
      const covered = cell?.covered ?? false;
      return covered ? (
        <span
          className={styles.hit}
          aria-label={`Data present for ${sourceId} in FY${row.fiscalYear}`}
        >
          ✓
        </span>
      ) : (
        <span className={styles.miss} aria-label={`No data for ${sourceId} in FY${row.fiscalYear}`}>
          ✗
        </span>
      );
    },
  })),
];

const gapColumns: readonly Column<ComparabilityGapGroup>[] = [
  { key: "source", header: "Source", render: (r) => r.sourceId },
  {
    key: "kind",
    header: "Gap kind",
    render: (r) => (r.gapKind === "internal-hole" ? "Internal hole" : "Truncated span"),
  },
  { key: "count", header: "Entities", align: "end", render: (r) => String(r.entityCount) },
  { key: "examples", header: "Examples (up to 3)", render: (r) => r.examples.join(", ") },
];

function ComparabilityBreaks({ notes }: { readonly notes: readonly string[] }): React.JSX.Element {
  if (notes.length === 0) {
    return <p>No comparability breaks recorded in this release.</p>;
  }
  return (
    <ul className={styles.noteList}>
      {notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );
}

export function Quality(): React.JSX.Element {
  const totalEntities = entities.length;
  const totalValues = values.length;
  return (
    <PageLayout
      eyebrow="Berkeley Budget Explorer"
      title="Data quality dashboard"
      intro="Source coverage, reconciliation status, freshness, and comparability breaks for the current release."
      footer={
        <>
          <small>
            Release {release.releaseId} generated {release.generatedAt}. Pipeline status:{" "}
            {data.status}. {data.sourceCount} pinned sources.
          </small>
          <ReportIssue />
        </>
      }
    >
      <nav className={styles.navLinks} aria-label="Route navigation">
        <a href="#/">Overview</a>
        <span aria-hidden="true">·</span>
        <a href="#/compare">Compare</a>
        <span aria-hidden="true">·</span>
        <a href="#/methodology">Methodology</a>
      </nav>

      <section aria-labelledby="release-heading" className={styles.section}>
        <h2 id="release-heading">Release status</h2>
        <DefinitionList
          ariaLabel="Release status"
          items={[
            { term: "Release", description: data.releaseId },
            { term: "Generated", description: data.generatedAt },
            { term: "Pipeline status", description: data.status },
            { term: "Sources pinned", description: String(data.sourceCount) },
            { term: "Canonical values", description: totalValues.toLocaleString("en-US") },
            { term: "Registered entities", description: totalEntities.toLocaleString("en-US") },
            {
              term: "Actual-stage values",
              description: data.normalizationCounts.actual.toLocaleString("en-US"),
            },
            {
              term: "Adopted-stage values",
              description: data.normalizationCounts.adopted.toLocaleString("en-US"),
            },
          ]}
        />
      </section>

      <section aria-labelledby="coverage-heading" className={styles.section}>
        <h2 id="coverage-heading">Source coverage by fiscal year</h2>
        <p>
          Each cell shows the number of canonical values for that source and fiscal year. A dash
          means no data is published for that year. The Trend column shows a sparkline of values per
          fiscal year — small inline line charts (80×20 pixels) so coverage patterns stay scannable
          without leaving the table.
        </p>
        <DataTable
          caption="Source coverage matrix: rows are sources, columns are fiscal years, cells are value counts."
          columns={coverageColumns}
          rows={data.coverageRows}
          getRowKey={(r) => r.sourceId}
        />
      </section>

      <section aria-labelledby="presence-heading" className={styles.section}>
        <h2 id="presence-heading">Year-by-source presence (FY2015–FY2025)</h2>
        <p>
          A focused recent view transposed from the table above: each row is one fiscal year, each
          column is one source, and each cell is a checkmark when at least one value exists. It
          highlights where the Socrata cohort ends (FY2015) and where the ACFR point-in-time appears
          (FY2025).
        </p>
        <DataTable
          caption="Presence matrix: rows are fiscal years FY2015-FY2025, columns are sources, cells are check (present) or cross (absent)."
          columns={presenceColumns}
          rows={data.yearPresenceRows}
          getRowKey={(r) => String(r.fiscalYear)}
        />
      </section>

      <section aria-labelledby="recon-heading" className={styles.section}>
        <h2 id="recon-heading">Reconciliation results</h2>
        <DataTable
          caption="Per-source reconciliation against published control totals."
          columns={reconciliationColumns}
          rows={data.reconciliation}
          getRowKey={(r) => r.sourceId}
        />
      </section>

      <section aria-labelledby="gaps-heading" className={styles.section}>
        <h2 id="gaps-heading">Comparability gaps</h2>
        <p>
          Entities whose year coverage does not span their source&apos;s full declared fiscal
          period. <code>Truncated span</code> means an entity starts late or ends early (for
          example, every Socrata department stops at FY2015). <code>Internal hole</code> means one
          or more years are missing between the entity&apos;s first and last observation.
        </p>
        {data.comparabilityGaps.length === 0 ? (
          <p>No partial-coverage entities detected in this release.</p>
        ) : (
          <DataTable
            caption="Entities with partial year coverage, grouped by source and gap kind."
            columns={gapColumns}
            rows={data.comparabilityGaps}
            getRowKey={(r) => `${r.sourceId}-${r.gapKind}`}
          />
        )}
      </section>

      <section aria-labelledby="comparability-heading" className={styles.section}>
        <h2 id="comparability-heading">Comparability breaks</h2>
        <p className={styles.warn}>
          These notes describe where series must not be stitched into a single trend without a
          visible warning.
        </p>
        <ComparabilityBreaks notes={data.comparabilityNotes} />
      </section>

      <section aria-labelledby="freshness-heading" className={styles.section}>
        <h2 id="freshness-heading">Data freshness</h2>
        <DataTable
          caption="Retrieval date per source manifest entry."
          columns={freshnessColumns}
          rows={data.freshness}
          getRowKey={(r) => r.sourceId}
        />
      </section>
    </PageLayout>
  );
}
