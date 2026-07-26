import * as Plot from "@observablehq/plot";
import { useEffect, useRef } from "react";
import styles from "./Sparkline.module.css";
import { mountPlot } from "./plot-utils";

export interface SparklinePoint {
  readonly x: number;
  readonly y: number;
}

interface SparklineProps {
  readonly points: readonly SparklinePoint[];
  readonly ariaLabel: string;
}

export function Sparkline({ points, ariaLabel }: SparklineProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (points.length === 0) {
      node.replaceChildren();
      return;
    }
    mountPlot(node, {
      width: 80,
      height: 20,
      marginLeft: 0,
      marginRight: 0,
      marginTop: 0,
      marginBottom: 0,
      style: { background: "transparent", color: "var(--color-ink)", fontSize: "8px" },
      x: { type: "linear" },
      y: { type: "linear" },
      marks: [
        Plot.areaY(points, {
          x: "x",
          y: "y",
          fill: "var(--color-accent-soft)",
          fillOpacity: 0.4,
        }),
        Plot.line(points, {
          x: "x",
          y: "y",
          stroke: "var(--color-accent)",
          strokeWidth: 1.25,
        }),
      ],
    });
    return () => {
      node.replaceChildren();
    };
  }, [points]);

  return (
    <div
      ref={ref}
      className={styles.sparkline}
      role="img"
      aria-label={ariaLabel}
      title={ariaLabel}
    />
  );
}
