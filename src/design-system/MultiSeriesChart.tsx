import * as Plot from "@observablehq/plot";
import { useEffect, useId, useMemo, useRef } from "react";
import type { Comparability } from "../pipeline/canonical/schema";
import { COMPARE_PALETTE } from "../query/compare-engine";
import styles from "./MultiSeriesChart.module.css";
import { colorAtIndex, mountPlot, standardPlotStyle } from "./plot-utils";

export interface MultiSeriesPoint {
  readonly fiscalYear: number;
  readonly amountCents: number;
  readonly seriesKey: string;
  readonly seriesLabel: string;
  readonly colorIndex: number;
  readonly comparability: Comparability;
}

export interface MultiSeriesData {
  readonly points: readonly MultiSeriesPoint[];
  readonly startYear: number;
  readonly endYear: number;
  readonly isPercentage: boolean;
}

interface MultiSeriesChartProps {
  readonly data: MultiSeriesData;
  readonly ariaLabel: string;
  readonly summary: string;
}

const SCHEMA_BREAK_YEAR = 2017;

interface SeriesSummary {
  readonly seriesKey: string;
  readonly seriesLabel: string;
  readonly colorIndex: number;
  readonly comparability: Comparability;
  readonly hasGaps: boolean;
}

function yLabelFor(isPercentage: boolean): string {
  return isPercentage ? "Value (%)" : "Amount (cents)";
}

function tickFormatFor(isPercentage: boolean): (d: number) => string {
  if (isPercentage) return (d) => `${(d / 100).toFixed(1)}%`;
  return (d) => {
    if (Math.abs(d) >= 100000000) return `$${Math.round(d / 10000000) / 10}B`;
    if (Math.abs(d) >= 100000) return `$${Math.round(d / 100000) / 10}M`;
    if (Math.abs(d) >= 100) return `$${Math.round(d / 100) / 10}K`;
    return `$${(d / 100).toFixed(0)}`;
  };
}

function colorFor(colorIndex: number): string {
  return COMPARE_PALETTE[colorIndex] ?? colorAtIndex(0);
}

// A series has "gaps" if its year coverage is non-contiguous. We use this to
// decide whether to render open-dot markers at the boundaries of internal gaps
// so missing years are visually explicit instead of hidden behind a stitched line.
function hasInternalGaps(
  points: readonly { readonly fiscalYear: number }[],
  startYear: number,
  endYear: number,
): boolean {
  if (points.length === 0) return false;
  const years = new Set(points.map((p) => p.fiscalYear));
  for (let fy = startYear; fy <= endYear; fy += 1) {
    if (!years.has(fy)) return true;
  }
  return false;
}

function summarizeSeries(data: MultiSeriesData): readonly SeriesSummary[] {
  const byKey = new Map<string, SeriesSummary>();
  for (const p of data.points) {
    const existing = byKey.get(p.seriesKey);
    if (existing) continue;
    const seriesPoints = data.points.filter((q) => q.seriesKey === p.seriesKey);
    byKey.set(p.seriesKey, {
      seriesKey: p.seriesKey,
      seriesLabel: p.seriesLabel,
      colorIndex: p.colorIndex,
      comparability: p.comparability,
      hasGaps: hasInternalGaps(seriesPoints, data.startYear, data.endYear),
    });
  }
  return [...byKey.values()];
}

// Returns the points that sit at the edges of internal gaps (the last point
// before a missing year and the first point after a missing year). These get
// rendered as larger open-dot markers so the reader can see exactly where the
// data breaks inside a series.
function gapBoundaryPoints(
  data: MultiSeriesData,
): readonly { fiscalYear: number; amountCents: number; color: string; seriesKey: string }[] {
  const out: { fiscalYear: number; amountCents: number; color: string; seriesKey: string }[] = [];
  const bySeries = new Map<string, readonly MultiSeriesPoint[]>();
  for (const p of data.points) {
    const list = bySeries.get(p.seriesKey) ?? [];
    bySeries.set(p.seriesKey, [...list, p]);
  }
  for (const [seriesKey, list] of bySeries) {
    const sorted = [...list].sort((a, b) => a.fiscalYear - b.fiscalYear);
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const cur = sorted[i];
      const next = sorted[i + 1];
      if (!cur || !next) continue;
      if (next.fiscalYear - cur.fiscalYear > 1) {
        out.push({
          fiscalYear: cur.fiscalYear,
          amountCents: cur.amountCents,
          color: colorFor(cur.colorIndex),
          seriesKey,
        });
        out.push({
          fiscalYear: next.fiscalYear,
          amountCents: next.amountCents,
          color: colorFor(next.colorIndex),
          seriesKey,
        });
      }
    }
  }
  return out;
}

export function MultiSeriesChart({
  data,
  ariaLabel,
  summary,
}: MultiSeriesChartProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const fallbackId = useId();
  const chartId = `compare-${fallbackId}`;
  const series = useMemo(() => summarizeSeries(data), [data]);
  const gapBoundaries = useMemo(() => gapBoundaryPoints(data), [data]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (data.points.length === 0) {
      node.replaceChildren();
      return;
    }

    const plotData = data.points.map((p) => ({
      ...p,
      color: colorFor(p.colorIndex),
    }));

    const lastPoints = plotData.filter((p, _i, arr) => {
      const sameSeries = arr.filter((q) => q.seriesKey === p.seriesKey);
      const maxYear = Math.max(...sameSeries.map((q) => q.fiscalYear));
      return p.fiscalYear === maxYear;
    });

    const hasBreak = data.startYear <= SCHEMA_BREAK_YEAR && data.endYear >= SCHEMA_BREAK_YEAR;

    const marks: Plot.Markish[] = [
      Plot.ruleY([0]),
      ...(hasBreak
        ? [
            Plot.ruleX([SCHEMA_BREAK_YEAR], {
              stroke: "var(--color-warn-ink)",
              strokeDasharray: "6,3",
              strokeWidth: 2,
            }),
          ]
        : []),
      Plot.line(plotData, {
        x: "fiscalYear",
        y: "amountCents",
        stroke: "color",
        strokeWidth: 1.75,
        z: "seriesKey",
      }),
      Plot.dot(plotData, {
        x: "fiscalYear",
        y: "amountCents",
        fill: "color",
        r: 2.5,
      }),
      // Open-ring markers at internal gap boundaries make missing-year
      // discontinuities explicit instead of stitching silently across gaps.
      ...(gapBoundaries.length > 0
        ? [
            Plot.dot(gapBoundaries, {
              x: "fiscalYear",
              y: "amountCents",
              stroke: "color",
              fill: "var(--color-surface)",
              r: 4,
              strokeWidth: 1.5,
            }),
          ]
        : []),
      Plot.text(lastPoints, {
        x: "fiscalYear",
        y: "amountCents",
        text: "seriesLabel",
        dx: 8,
        textAnchor: "start",
        fill: "color",
        fontSize: 11,
        fontWeight: 600,
      }),
    ];

    if (hasBreak) {
      marks.push(
        Plot.text([{ x: SCHEMA_BREAK_YEAR }], {
          x: "x",
          text: () => "◆",
          fill: "var(--color-warn-ink)",
          fontSize: 10,
          dx: 4,
          textAnchor: "start",
          frameAnchor: "top",
        }),
        Plot.text([{ x: SCHEMA_BREAK_YEAR }], {
          x: "x",
          text: () => "SCO schema change",
          fill: "var(--color-warn-ink)",
          fontSize: 10,
          fontWeight: 600,
          dx: 12,
          textAnchor: "start",
          frameAnchor: "top",
        }),
      );
    }

    const style = standardPlotStyle({
      width: Math.min(720, node.clientWidth || 640),
      height: 340,
      marginLeft: 72,
      marginRight: 140,
      marginBottom: 48,
    });
    mountPlot(node, {
      ...style,
      x: { label: "Fiscal year", tickFormat: String, nice: true },
      y: {
        label: yLabelFor(data.isPercentage),
        grid: true,
        nice: true,
        tickFormat: tickFormatFor(data.isPercentage),
      },
      marks,
    });
    return () => {
      node.replaceChildren();
    };
  }, [data, gapBoundaries]);

  return (
    <figure className={styles.figure} aria-labelledby={`${chartId}-title`}>
      <figcaption id={`${chartId}-title`} className={styles.caption}>
        {ariaLabel}
      </figcaption>
      <div ref={ref} className={styles.chart} role="img" aria-label={ariaLabel} />
      {series.length > 0 ? (
        <ul className={styles.legend} aria-label="Chart legend">
          {series.map((s) => {
            const color = colorFor(s.colorIndex);
            const isApproximate = s.comparability !== "exact";
            return (
              <li key={s.seriesKey} className={styles.legendItem}>
                <span
                  className={
                    isApproximate
                      ? `${styles.legendSwatch} ${styles.legendSwatchPartial}`
                      : styles.legendSwatch
                  }
                  style={{ background: color }}
                  aria-hidden="true"
                />
                <span className={styles.legendLabel}>{s.seriesLabel}</span>
                {isApproximate ? (
                  <span
                    className={styles.legendBadge}
                    title="Partial year coverage or reconstructed series"
                  >
                    partial coverage
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className={styles.summary}>{summary}</p>
    </figure>
  );
}
