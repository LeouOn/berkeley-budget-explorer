import * as Plot from "@observablehq/plot";
import { useEffect, useId, useRef } from "react";
import { COMPARE_PALETTE } from "../query/compare-engine";
import styles from "./MultiSeriesChart.module.css";
import { colorAtIndex, mountPlot, standardPlotStyle } from "./plot-utils";

export interface MultiSeriesPoint {
  readonly fiscalYear: number;
  readonly amountCents: number;
  readonly seriesKey: string;
  readonly seriesLabel: string;
  readonly colorIndex: number;
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

export function MultiSeriesChart({
  data,
  ariaLabel,
  summary,
}: MultiSeriesChartProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const fallbackId = useId();
  const chartId = `compare-${fallbackId}`;

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
  }, [data]);

  return (
    <figure className={styles.figure} aria-labelledby={`${chartId}-title`}>
      <figcaption id={`${chartId}-title`} className={styles.caption}>
        {ariaLabel}
      </figcaption>
      <div ref={ref} className={styles.chart} role="img" aria-label={ariaLabel} />
      <p className={styles.summary}>{summary}</p>
    </figure>
  );
}
