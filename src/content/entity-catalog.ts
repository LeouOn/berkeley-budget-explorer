import type { BudgetValue, Entity } from "../pipeline/canonical/schema";

export interface CatalogEntry {
  readonly entityId: string;
  readonly name: string;
  readonly type: Entity["type"];
  readonly sourceId: string;
  readonly sourceLabel: string;
  readonly minYear: number;
  readonly maxYear: number;
  readonly yearCount: number;
  readonly valueCount: number;
}

export interface CatalogGroup {
  readonly label: string;
  readonly entries: readonly CatalogEntry[];
}

const GROUP_LABELS: Record<string, string> = {
  "src-sco-expenditures-per-capita-ykhf-vfsr": "Citywide totals (SCO per-capita)",
  "src-sco-revenues-per-capita-ky7j-fsk5": "Citywide totals (SCO per-capita)",
  "src-sco-expenditures-ju3w-4gxp": "Expenditure categories (SCO detailed)",
  "src-berkeley-socrata-gy8t-iqc4": "Departments (Socrata cohort)",
};

const SOURCE_PRIORITY: readonly string[] = [
  "src-sco-expenditures-per-capita-ykhf-vfsr",
  "src-sco-revenues-per-capita-ky7j-fsk5",
  "src-sco-expenditures-ju3w-4gxp",
  "src-berkeley-socrata-gy8t-iqc4",
];

function groupLabelFor(sourceId: string): string {
  return GROUP_LABELS[sourceId] ?? sourceId;
}

function groupPriority(sourceId: string): number {
  const idx = SOURCE_PRIORITY.indexOf(sourceId);
  return idx >= 0 ? idx : SOURCE_PRIORITY.length;
}

interface EntityAccumulator {
  readonly entityId: string;
  readonly entityType: Entity["type"];
  readonly sourceId: string;
  readonly sourceLabel: string;
  minYear: number;
  maxYear: number;
  yearSet: Set<number>;
  valueCount: number;
}

export function buildEntityCatalog(
  entities: readonly Entity[],
  values: readonly BudgetValue[],
): readonly CatalogGroup[] {
  const nameById = new Map<string, string>();
  for (const e of entities) {
    nameById.set(e.id, e.canonicalName);
  }

  const accById = new Map<string, EntityAccumulator>();
  for (const v of values) {
    const existing = accById.get(v.entityId);
    if (existing) {
      existing.minYear = Math.min(existing.minYear, v.fiscalYear);
      existing.maxYear = Math.max(existing.maxYear, v.fiscalYear);
      existing.yearSet.add(v.fiscalYear);
      existing.valueCount += 1;
    } else {
      accById.set(v.entityId, {
        entityId: v.entityId,
        entityType: v.entityType,
        sourceId: v.sourceId,
        sourceLabel: v.sourceLabel,
        minYear: v.fiscalYear,
        maxYear: v.fiscalYear,
        yearSet: new Set([v.fiscalYear]),
        valueCount: 1,
      });
    }
  }

  const entries: CatalogEntry[] = [];
  for (const acc of accById.values()) {
    const name = nameById.get(acc.entityId) ?? acc.entityId;
    entries.push({
      entityId: acc.entityId,
      name,
      type: acc.entityType,
      sourceId: acc.sourceId,
      sourceLabel: acc.sourceLabel,
      minYear: acc.minYear,
      maxYear: acc.maxYear,
      yearCount: acc.yearSet.size,
      valueCount: acc.valueCount,
    });
  }

  const groupMap = new Map<string, { sourceId: string; entries: CatalogEntry[] }>();
  for (const entry of entries) {
    const label = groupLabelFor(entry.sourceId);
    const existing = groupMap.get(label);
    if (existing) {
      existing.entries.push(entry);
    } else {
      groupMap.set(label, { sourceId: entry.sourceId, entries: [entry] });
    }
  }

  const groups: CatalogGroup[] = [];
  const sortedLabels = [...groupMap.keys()].sort((a, b) => {
    const aSource = groupMap.get(a)?.sourceId ?? "";
    const bSource = groupMap.get(b)?.sourceId ?? "";
    const diff = groupPriority(aSource) - groupPriority(bSource);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
  for (const label of sortedLabels) {
    const entry = groupMap.get(label);
    if (!entry) continue;
    const sortedEntries = [...entry.entries].sort((a, b) => a.name.localeCompare(b.name));
    groups.push({ label, entries: sortedEntries });
  }

  return groups;
}
