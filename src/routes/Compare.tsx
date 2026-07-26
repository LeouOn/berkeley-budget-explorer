import { useCallback, useSyncExternalStore } from "react";
import cpiData from "../artifacts/cpi.json" with { type: "json" };
import entitiesData from "../artifacts/entities.json" with { type: "json" };
import populationData from "../artifacts/population.json" with { type: "json" };
import releaseData from "../artifacts/release.json" with { type: "json" };
import valuesData from "../artifacts/values.json" with { type: "json" };
import { buildEntityCatalog } from "../content/entity-catalog";
import { DataTable, MultiSeriesChart, PageLayout, Toggle } from "../design-system";
import type { BudgetValue, Entity } from "../pipeline/canonical/schema";
import type { PopulationObservation } from "../pipeline/derive/derive";
import type { FiscalYearAverage } from "../pipeline/sources/bls-cpi";
import type { SourceManifest } from "../pipeline/sources/manifest";
import manifestData from "../pipeline/sources/manifest.data.json" with { type: "json" };
import { COMPARE_PALETTE, compareSeries } from "../query/compare-engine";
import {
  type CompareUrlState,
  parseCompareUrl,
  serializeCompareUrl,
} from "../query/compare-url-state";
import { comparisonToCsv, downloadCsv } from "../query/csv-export";
import styles from "./Compare.module.css";
import { EntityPicker } from "./EntityPicker";
import {
  buildChartData,
  buildTableColumns,
  buildTableRows,
  isPercentageUnit,
  modeOptions,
  unitOptions,
} from "./compare-view";

interface CpiArtifact {
  readonly fiscalYearAverages: readonly FiscalYearAverage[];
}

const cpiAverages = (cpiData as CpiArtifact).fiscalYearAverages;
const values = valuesData as readonly BudgetValue[];
const entities = entitiesData as readonly Entity[];
const populationObs = (
  populationData as { readonly observations: readonly PopulationObservation[] }
).observations;
const release = releaseData as {
  readonly releaseId: string;
  readonly generatedAt: string;
};
const manifest = manifestData as SourceManifest;

const catalog = buildEntityCatalog(entities, values);

function subscribeToUrl(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  window.addEventListener("bbe:url-change", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
    window.removeEventListener("bbe:url-change", listener);
  };
}

function getUrlSnapshot(): string {
  return window.location.hash;
}

function getServerSnapshot(): string {
  return "";
}

function useCompareUrlState(): {
  state: CompareUrlState;
  update: (next: Partial<CompareUrlState>) => void;
} {
  const hash = useSyncExternalStore(subscribeToUrl, getUrlSnapshot, getServerSnapshot);
  const searchPart = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const state = parseCompareUrl(searchPart);
  const update = useCallback(
    (next: Partial<CompareUrlState>) => {
      const merged: CompareUrlState = { ...state, ...next };
      const serialized = serializeCompareUrl(merged);
      const route = hash.split("?")[0] ?? "#/compare";
      window.location.hash = `${route}${serialized}`;
      window.dispatchEvent(new Event("bbe:url-change"));
    },
    [state, hash],
  );
  return { state, update };
}

export function Compare(): React.JSX.Element {
  const { state, update } = useCompareUrlState();
  const result = compareSeries({
    values,
    entities,
    cpi: cpiAverages,
    population: populationObs,
    entityIds: state.entityIds,
    yearRange: [state.startYear, state.endYear],
    mode: state.mode,
    unit: state.unit,
    baseYear: state.baseYear,
    originalLabels: state.originalLabels,
  });
  const isPercentage = isPercentageUnit(state.unit);
  const columns = buildTableColumns(result.series, isPercentage);
  const rows = buildTableRows(result);
  const chartData = buildChartData(result, isPercentage);
  const hasSelection = state.entityIds.length > 0 && result.series.length > 0;
  const summary = hasSelection
    ? `${result.series.length} series from FY${state.startYear} to FY${state.endYear}, ${state.mode} dollars, ${state.unit}.`
    : "Select up to 4 entities from the catalog to build a comparison.";

  const handleToggleEntity = useCallback(
    (entityId: string) => {
      const isSelected = state.entityIds.includes(entityId);
      const next = isSelected
        ? state.entityIds.filter((id) => id !== entityId)
        : [...state.entityIds, entityId];
      update({ entityIds: next });
    },
    [state.entityIds, update],
  );

  const handleRemoveEntity = useCallback(
    (entityId: string) => {
      update({ entityIds: state.entityIds.filter((id) => id !== entityId) });
    },
    [state.entityIds, update],
  );

  const handleExport = useCallback(() => {
    const sourceIdSet = new Set<string>();
    for (const s of result.series) {
      for (const p of s.points) {
        for (const id of p.sourceIds) sourceIdSet.add(id);
      }
    }
    const usedSourceIds = [...sourceIdSet].sort();
    const retrievedBySourceId = new Map<string, string>(
      manifest.sources.map((s) => [s.id, s.retrievedAt]),
    );
    const retrievedDates = usedSourceIds
      .map((id) => retrievedBySourceId.get(id))
      .filter((d): d is string => typeof d === "string");

    const earliestRetrievedAt = retrievedDates.length > 0 ? (retrievedDates.sort()[0] ?? "") : "";
    const csv = comparisonToCsv(result, isPercentage, {
      generatedAt: release.generatedAt,
      sourceIds: usedSourceIds,
      earliestRetrievedAt,
    });
    downloadCsv(`berkeley-budget-compare-${release.releaseId}.csv`, csv);
  }, [result, isPercentage]);

  return (
    <PageLayout
      eyebrow="Compare"
      title="Budget comparison workspace"
      intro="Select up to 4 entities to compare across fiscal years. Toggle between real and nominal dollars, switch units, and export the underlying records."
      footer={
        <small>
          Release {release.releaseId}. Comparison values derive from the same SCO standardized
          actuals as the Overview. Category sums are never added to the citywide total.
        </small>
      }
    >
      <nav className={styles.navLinks} aria-label="Route navigation">
        <a href="#/">Overview</a>
        <span aria-hidden="true">·</span>
        <a href="#/quality">Quality</a>
        <span aria-hidden="true">·</span>
        <a href="#/methodology">Methodology</a>
      </nav>

      <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-label="Entity selection">
          <EntityPicker
            groups={catalog}
            selectedIds={state.entityIds}
            onToggle={handleToggleEntity}
          />
        </aside>

        <section className={styles.main} aria-labelledby="compare-main-heading">
          <h2 id="compare-main-heading" className={styles.srOnly}>
            Comparison results
          </h2>

          <div className={styles.controlsBar}>
            <Toggle
              legend="Dollar mode"
              options={modeOptions}
              value={state.mode}
              onChange={(next) => update({ mode: next })}
            />
            <Toggle
              legend="Unit"
              options={unitOptions}
              value={state.unit}
              onChange={(next) => update({ unit: next })}
            />
            <label className={styles.originalLabelsToggle}>
              <input
                type="checkbox"
                checked={state.originalLabels}
                onChange={(e) => update({ originalLabels: e.currentTarget.checked })}
              />
              Show original source labels
            </label>
          </div>

          {state.entityIds.length > 0 && (
            <ul className={styles.chips} aria-label="Selected entities">
              {result.series.map((s) => (
                <li key={s.entityId} className={styles.chip}>
                  <span
                    className={styles.chipDot}
                    style={{ background: COMPARE_PALETTE[s.colorIndex] }}
                    aria-hidden="true"
                  />
                  <span className={styles.chipLabel}>
                    {s.entityName}
                    {state.originalLabels && s.sourceLabel ? (
                      <span className={styles.chipSourceLabel}>{s.sourceLabel}</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className={styles.chipRemove}
                    onClick={() => handleRemoveEntity(s.entityId)}
                    aria-label={`Remove ${s.entityName}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {hasSelection ? (
            <>
              <MultiSeriesChart
                data={chartData}
                ariaLabel={`Comparison chart: ${summary}`}
                summary={summary}
              />
              <DataTable
                caption="Synchronized comparison data (matches the chart above)."
                columns={columns}
                rows={rows}
                getRowKey={(r) => String(r.fiscalYear)}
              />
              <button type="button" className={styles.exportBtn} onClick={handleExport}>
                Download CSV
              </button>
            </>
          ) : (
            <div className={styles.emptyState}>
              <p>No entities selected yet.</p>
              <p className={styles.emptyHint}>
                Pick up to 4 entities from the catalog on the left to build a comparison.
              </p>
            </div>
          )}

          <section aria-labelledby="comparability-heading" className={styles.notesPanel}>
            <h3 id="comparability-heading">Comparability notes</h3>
            <ul>
              <li>
                The SCO detailed expenditure schema changes materially in FY2017. Pre-2017
                categories end at FY2017; post-2017 categories begin at FY2017 or FY2018.
              </li>
              <li>
                Entities whose coverage does not span the full selected year range are marked{" "}
                <code>approximate</code>. Full-coverage entities are marked <code>exact</code>.
              </li>
              <li>
                Share-of-total uses the sum of all expense categories for each fiscal year, not just
                the selected entities.
              </li>
            </ul>
          </section>
        </section>
      </div>
    </PageLayout>
  );
}
