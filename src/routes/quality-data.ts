import type { BudgetValue, Entity } from "../pipeline/canonical/schema";
import type { QualityReport } from "../pipeline/derive/quality-report";
import type { SourceEntry, SourceManifest } from "../pipeline/sources/manifest";

export interface SourceCoverageCell {
  readonly sourceId: string;
  readonly fiscalYear: number;
  readonly valueCount: number;
  readonly covered: boolean;
}

export interface SourceCoverageRow {
  readonly sourceId: string;
  readonly title: string;
  readonly cells: readonly SourceCoverageCell[];
}

export interface FreshnessEntry {
  readonly sourceId: string;
  readonly retrievedAt: string;
}

// Year-by-source presence matrix (transposed view of the coverage table):
// each row is one fiscal year, each cell is a boolean presence flag.
export interface YearPresenceCell {
  readonly sourceId: string;
  readonly covered: boolean;
}

export interface YearPresenceRow {
  readonly fiscalYear: number;
  readonly cells: readonly YearPresenceCell[];
}

export type ComparabilityGapKind = "truncated" | "internal-hole";

// A summary of entities under one source whose year coverage is partial relative
// to the source's declared fiscal span. `examples` are entity display names
// (capped) so the table stays scannable even when a cohort has dozens of
// partially-covered entities.
export interface ComparabilityGapGroup {
  readonly sourceId: string;
  readonly gapKind: ComparabilityGapKind;
  readonly entityCount: number;
  readonly examples: readonly string[];
}

export interface QualityDataInput {
  readonly manifest: SourceManifest;
  readonly values: readonly BudgetValue[];
  readonly entities: readonly Entity[];
  readonly quality: QualityReport;
}

export interface QualityData {
  readonly coverageRows: readonly SourceCoverageRow[];
  readonly fiscalYears: readonly number[];
  readonly freshness: readonly FreshnessEntry[];
  readonly reconciliation: QualityReport["reconciliation"];
  readonly comparabilityNotes: QualityReport["comparabilityNotes"];
  readonly status: QualityReport["status"];
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly sourceCount: number;
  readonly normalizationCounts: QualityReport["normalizationCounts"];
  readonly yearPresenceRows: readonly YearPresenceRow[];
  readonly presenceSourceIds: readonly string[];
  readonly comparabilityGaps: readonly ComparabilityGapGroup[];
}

// Focused recent window for the year-by-source presence matrix per the Phase 3
// dashboard spec. Earlier years remain visible in the detailed coverage table.
const PRESENCE_START_YEAR = 2015;
const PRESENCE_END_YEAR = 2025;
const MAX_GAP_EXAMPLES = 3;

interface EntityCoverage {
  readonly sourceId: string;
  readonly years: Set<number>;
}

interface SourceSpan {
  readonly start: number;
  readonly end: number;
}

function declaredSpan(source: SourceEntry): SourceSpan | null {
  if (source.fiscalPeriods.length === 0) return null;
  return {
    start: Math.min(...source.fiscalPeriods.map((p) => p.start)),
    end: Math.max(...source.fiscalPeriods.map((p) => p.end)),
  };
}

function classifyGap(
  sortedYears: readonly number[],
  span: SourceSpan,
): ComparabilityGapKind | null {
  if (sortedYears.length === 0) return null;
  const minYear = sortedYears[0] ?? 0;
  const maxYear = sortedYears[sortedYears.length - 1] ?? 0;
  const hasInternalHole = sortedYears.some((year, i) => {
    if (i === 0) return false;
    const prev = sortedYears[i - 1];
    return prev !== undefined && year - prev > 1;
  });
  const truncatedAtBoundary = minYear > span.start || maxYear < span.end;
  if (hasInternalHole) return "internal-hole";
  if (truncatedAtBoundary) return "truncated";
  return null;
}

function buildComparabilityGaps(
  values: readonly BudgetValue[],
  entities: readonly Entity[],
  manifest: SourceManifest,
): readonly ComparabilityGapGroup[] {
  const nameById = new Map<string, string>();
  for (const e of entities) nameById.set(e.id, e.canonicalName);

  const spanBySourceId = new Map<string, SourceSpan>();
  for (const s of manifest.sources) {
    const span = declaredSpan(s);
    if (span) spanBySourceId.set(s.id, span);
  }

  const coverageByEntity = new Map<string, EntityCoverage>();
  for (const v of values) {
    const existing = coverageByEntity.get(v.entityId);
    if (existing) {
      existing.years.add(v.fiscalYear);
    } else {
      coverageByEntity.set(v.entityId, {
        sourceId: v.sourceId,
        years: new Set([v.fiscalYear]),
      });
    }
  }

  const groups = new Map<
    string,
    { sourceId: string; gapKind: ComparabilityGapKind; count: number; examples: string[] }
  >();
  for (const [entityId, cov] of coverageByEntity) {
    const span = spanBySourceId.get(cov.sourceId);
    if (!span) continue;
    const sortedYears = [...cov.years].sort((a, b) => a - b);
    const gapKind = classifyGap(sortedYears, span);
    if (gapKind === null) continue;
    const key = `${cov.sourceId}::${gapKind}`;
    const existing = groups.get(key);
    const name = nameById.get(entityId) ?? entityId;
    if (existing) {
      existing.count += 1;
      if (existing.examples.length < MAX_GAP_EXAMPLES) existing.examples.push(name);
    } else {
      groups.set(key, {
        sourceId: cov.sourceId,
        gapKind,
        count: 1,
        examples: [name],
      });
    }
  }

  return [...groups.values()]
    .sort((a, b) => {
      if (a.sourceId !== b.sourceId) return a.sourceId.localeCompare(b.sourceId);
      return a.gapKind.localeCompare(b.gapKind);
    })
    .map((g) => ({
      sourceId: g.sourceId,
      gapKind: g.gapKind,
      entityCount: g.count,
      examples: g.examples,
    }));
}

export function buildQualityData(input: QualityDataInput): QualityData {
  const yearSet = new Set<number>();
  for (const v of input.values) yearSet.add(v.fiscalYear);
  for (const s of input.manifest.sources) {
    for (const p of s.fiscalPeriods) {
      for (let fy = p.start; fy <= p.end; fy += 1) yearSet.add(fy);
    }
  }
  const fiscalYears = [...yearSet].sort((a, b) => a - b);

  const coverageRows: SourceCoverageRow[] = input.manifest.sources.map((s) => {
    const cells: SourceCoverageCell[] = fiscalYears.map((fy) => {
      const valueCount = input.values.filter(
        (v) => v.sourceId === s.id && v.fiscalYear === fy,
      ).length;
      return { sourceId: s.id, fiscalYear: fy, valueCount, covered: valueCount > 0 };
    });
    return { sourceId: s.id, title: s.title, cells };
  });

  const freshness: FreshnessEntry[] = input.manifest.sources.map((s) => ({
    sourceId: s.id,
    retrievedAt: s.retrievedAt,
  }));

  const presenceSourceIds = input.manifest.sources.map((s) => s.id);
  const presenceYears: number[] = [];
  for (let fy = PRESENCE_START_YEAR; fy <= PRESENCE_END_YEAR; fy += 1) {
    presenceYears.push(fy);
  }
  const yearPresenceRows: YearPresenceRow[] = presenceYears.map((fy) => ({
    fiscalYear: fy,
    cells: presenceSourceIds.map((sourceId) => ({
      sourceId,
      covered: input.values.some((v) => v.sourceId === sourceId && v.fiscalYear === fy),
    })),
  }));

  const comparabilityGaps = buildComparabilityGaps(input.values, input.entities, input.manifest);

  return {
    coverageRows,
    fiscalYears,
    freshness,
    reconciliation: input.quality.reconciliation,
    comparabilityNotes: input.quality.comparabilityNotes,
    status: input.quality.status,
    releaseId: input.quality.releaseId,
    generatedAt: input.quality.generatedAt,
    sourceCount: input.quality.sourceCount,
    normalizationCounts: input.quality.normalizationCounts,
    yearPresenceRows,
    presenceSourceIds,
    comparabilityGaps,
  };
}
