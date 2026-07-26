import * as Plot from "@observablehq/plot";
import { useEffect, useId, useRef } from "react";
import styles from "./TrendChart.module.css";
import { mountPlot, standardPlotStyle } from "./plot-utils";

export interface TrendPoint {
  readonly fiscalYear: number;
  readonly amountCents: number;
}

interface TrendChartProps {
  readonly points: readonly TrendPoint[];
  readonly baseYear: number;
  readonly yLabel: string;
  readonly ariaLabel: string;
  readonly summary: string;
}

export function TrendChart({
  points,
  baseYear,
  yLabel,
  ariaLabel,
  summary,
}: TrendChartProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const fallbackId = useId();
  const chartId = `trend-${fallbackId}`;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const style = standardPlotStyle({ width: 640, height: 320, marginBottom: 50 });
    mountPlot(node, {
      ...style,
      x: { label: "Fiscal year", tickFormat: (d) => String(d), nice: true },
      y: { label: `${yLabel} (base ${baseYear})`, grid: true, nice: true },
      marks: [
        Plot.ruleY([0]),
        Plot.line(points, {
          x: "fiscalYear",
          y: "amountCents",
          stroke: "var(--color-ink)",
          strokeWidth: 1.5,
        }),
        Plot.dot(points, {
          x: "fiscalYear",
          y: "amountCents",
          fill: "var(--color-ink)",
          r: 3,
        }),
        Plot.text(points, {
          x: "fiscalYear",
          y: "amountCents",
          text: (d) => String(d.fiscalYear),
          dy: -10,
          fill: "var(--color-ink-muted)",
          fontSize: 10,
        }),
      ],
    });
    return () => {
      node.replaceChildren();
    };
  }, [points, baseYear, yLabel]);

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
