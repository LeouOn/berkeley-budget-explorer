import type { Column, MultiSeriesData, ToggleOption } from "../design-system";
import type { CompareMode, CompareResult, CompareUnit } from "../query/compare-engine";
import { formatCents } from "../query/engine";

export const modeOptions: readonly ToggleOption<CompareMode>[] = [
  { value: "real", label: "Real" },
  { value: "nominal", label: "Nominal" },
];

export const unitOptions: readonly ToggleOption<CompareUnit>[] = [
  { value: "absolute", label: "$" },
  { value: "per-resident", label: "/resident" },
  { value: "percent-change", label: "% change" },
  { value: "share-of-total", label: "% of total" },
];

export const PERCENTAGE_UNITS: ReadonlySet<CompareUnit> = new Set([
  "percent-change",
  "share-of-total",
]);

export interface CompareTableRow {
  readonly fiscalYear: number;
  readonly cells: readonly (number | null)[];
  readonly comparabilities: readonly string[];
}

export function buildTableColumns(
  series: readonly { entityName: string }[],
  isPercentage: boolean,
): readonly Column<CompareTableRow>[] {
  return [
    { key: "fy", header: "Fiscal Year", render: (r) => `FY${r.fiscalYear}` },
    ...series.map((s, idx) => ({
      key: `col-${idx}`,
      header: s.entityName,
      align: "end" as const,
      render: (r: CompareTableRow) => {
        const val = r.cells[idx];
        if (val === null || val === undefined) return "—";
        return isPercentage ? `${(val / 100).toFixed(2)}%` : formatCents(val);
      },
    })),
  ];
}

export function buildTableRows(result: CompareResult): readonly CompareTableRow[] {
  return result.fiscalYears.map((fy) => {
    const cells: (number | null)[] = [];
    const comparabilities: string[] = [];
    for (const s of result.series) {
      const pt = s.points.find((p) => p.fiscalYear === fy);
      cells.push(pt ? pt.amountCents : null);
      comparabilities.push(pt?.comparability ?? "—");
    }
    return { fiscalYear: fy, cells, comparabilities };
  });
}

export function buildChartData(result: CompareResult, isPercentage: boolean): MultiSeriesData {
  const points = result.series.flatMap((s) =>
    s.points.map((p) => ({
      fiscalYear: p.fiscalYear,
      amountCents: p.amountCents,
      seriesKey: s.entityId,
      seriesLabel: s.entityName,
      colorIndex: s.colorIndex,
    })),
  );
  return {
    points,
    startYear: result.fiscalYears[0] ?? 2003,
    endYear: result.fiscalYears[result.fiscalYears.length - 1] ?? 2024,
    isPercentage,
  };
}

export function isPercentageUnit(unit: CompareUnit): boolean {
  return PERCENTAGE_UNITS.has(unit);
}
