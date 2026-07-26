import type { CompareResult, CompareSeries } from "./compare-engine";

const PercentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CSV_SOURCE_LINE = "Berkeley Budget Explorer (berkeley-budget.example)";
const CSV_METHODOLOGY_LINE = "/#/methodology";

export interface CsvCitationMetadata {
  readonly generatedAt: string;
  readonly sourceIds: readonly string[];
  readonly earliestRetrievedAt: string;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatValue(amountCents: number, isPercentage: boolean): string {
  if (isPercentage) {
    return PercentFormatter.format(amountCents / 100);
  }
  return String(amountCents);
}

export function comparisonToCsv(
  result: CompareResult,
  isPercentage: boolean,
  metadata?: CsvCitationMetadata,
): string {
  const series: readonly CompareSeries[] = result.series;
  if (series.length === 0) {
    return `${csvEscape("Fiscal Year")}\n`;
  }

  const header = [csvEscape("Fiscal Year"), ...series.map((s) => csvEscape(s.entityName))].join(
    ",",
  );

  const allYears = new Set<number>();
  for (const s of series) {
    for (const p of s.points) {
      allYears.add(p.fiscalYear);
    }
  }
  const sortedYears = [...allYears].sort((a, b) => a - b);

  const rows: string[] = [header];
  for (const fy of sortedYears) {
    const cells = [String(fy)];
    for (const s of series) {
      const point = s.points.find((p) => p.fiscalYear === fy);
      if (point) {
        cells.push(formatValue(point.amountCents, isPercentage));
      } else {
        cells.push("");
      }
    }
    rows.push(cells.join(","));
  }

  if (metadata) {
    rows.push(`# Source: ${CSV_SOURCE_LINE}`);
    rows.push(`# Generated: ${metadata.generatedAt}`);
    rows.push(`# Sources: ${metadata.sourceIds.join(",")}`);
    rows.push(`# Data retrieved: ${metadata.earliestRetrievedAt}`);
    rows.push(`# Full methodology: ${CSV_METHODOLOGY_LINE}`);
  }

  return `${rows.join("\n")}\n`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
