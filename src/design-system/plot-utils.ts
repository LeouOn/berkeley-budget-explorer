import * as Plot from "@observablehq/plot";

export interface PlotStyleOptions {
  readonly width?: number;
  readonly height?: number;
  readonly marginLeft?: number;
  readonly marginRight?: number;
  readonly marginTop?: number;
  readonly marginBottom?: number;
}

const STANDARD_STYLE = {
  background: "transparent",
  color: "var(--color-ink)",
  fontSize: "12px",
} as const;

export function standardPlotStyle(options: PlotStyleOptions): {
  readonly width: number;
  readonly height: number;
  readonly marginLeft: number;
  readonly marginRight: number;
  readonly marginTop: number;
  readonly marginBottom: number;
  readonly style: {
    readonly background: string;
    readonly color: string;
    readonly fontSize: string;
  };
} {
  return {
    width: options.width ?? 640,
    height: options.height ?? 320,
    marginLeft: options.marginLeft ?? 70,
    marginRight: options.marginRight ?? 40,
    marginTop: options.marginTop ?? 16,
    marginBottom: options.marginBottom ?? 48,
    style: STANDARD_STYLE,
  };
}

export interface PlotConfig {
  readonly width: number;
  readonly height: number;
  readonly marginLeft: number;
  readonly marginRight: number;
  readonly marginTop: number;
  readonly marginBottom: number;
  readonly style: {
    readonly background: string;
    readonly color: string;
    readonly fontSize: string;
  };
  readonly marks: readonly Plot.Markish[];
  readonly x?: Plot.ScaleOptions;
  readonly y?: Plot.ScaleOptions;
}

export function mountPlot(node: HTMLElement, config: PlotConfig): ReturnType<typeof Plot.plot> {
  const options: Plot.PlotOptions = {
    width: config.width,
    height: config.height,
    marginLeft: config.marginLeft,
    marginRight: config.marginRight,
    marginTop: config.marginTop,
    marginBottom: config.marginBottom,
    style: config.style,
    marks: [...config.marks],
  };
  if (config.x) options.x = config.x;
  if (config.y) options.y = config.y;
  const chart = Plot.plot(options);
  node.replaceChildren(chart);
  for (const g of node.querySelectorAll("g[aria-label]")) {
    g.removeAttribute("aria-label");
  }
  return chart;
}

const PLOT_PALETTE = [
  "var(--color-accent)",
  "var(--color-positive)",
  "var(--color-focus)",
  "var(--color-negative)",
  "var(--color-warn-ink)",
  "var(--color-ink-muted)",
  "var(--color-accent-soft)",
] as const;

export function plotColors(n: number): readonly string[] {
  if (n <= 0) return [];
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push(PLOT_PALETTE[i % PLOT_PALETTE.length] ?? "var(--color-ink)");
  }
  return out;
}

export function colorAtIndex(index: number): string {
  return PLOT_PALETTE[index % PLOT_PALETTE.length] ?? "var(--color-ink)";
}

const CENTS_PER_DOLLAR = 100;
const CENTS_PER_THOUSAND = 100_000;
const CENTS_PER_MILLION = 100_000_000;
const CENTS_PER_BILLION = 100_000_000_000;

export function formatCentsAxis(cents: number): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  if (abs >= CENTS_PER_BILLION) {
    return `${sign}$${Math.round(abs / (CENTS_PER_BILLION / 10)) / 10}B`;
  }
  if (abs >= CENTS_PER_MILLION) {
    return `${sign}$${Math.round(abs / (CENTS_PER_MILLION / 10)) / 10}M`;
  }
  if (abs >= CENTS_PER_THOUSAND) {
    return `${sign}$${Math.round(abs / (CENTS_PER_THOUSAND / 10)) / 10}K`;
  }
  return `${sign}$${Math.round(abs / CENTS_PER_DOLLAR)}`;
}

export function formatCentsPercentAxis(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(1)}%`;
}
