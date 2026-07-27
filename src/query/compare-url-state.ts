import { z } from "zod";
import { type CompareMode, type CompareUnit, MAX_COMPARE_ENTITIES } from "./compare-engine";

export { MAX_COMPARE_ENTITIES } from "./compare-engine";

export interface CompareUrlState {
  readonly entityIds: readonly string[];
  readonly startYear: number;
  readonly endYear: number;
  readonly mode: CompareMode;
  readonly unit: CompareUnit;
  readonly baseYear: number;
  readonly originalLabels: boolean;
  readonly stageFilter: string | null;
}

const CompareModeSchema = z.enum(["real", "nominal"]);
const CompareUnitSchema = z.enum(["absolute", "per-resident", "percent-change", "share-of-total"]);
const YearSchema = z.coerce.number().int().min(1990).max(2100);
const EntityIdSchema = z
  .string()
  .regex(/^ent-[a-z0-9-]+$/)
  .max(120);

export const DEFAULT_START_YEAR = 2003;
export const DEFAULT_END_YEAR = 2024;
export const DEFAULT_MODE: CompareMode = "real";
export const DEFAULT_UNIT: CompareUnit = "absolute";
export const DEFAULT_BASE_YEAR = 2024;
export const DEFAULT_ORIGINAL_LABELS = false;
export const DEFAULT_STAGE_FILTER: string | null = null;

export function parseCompareUrl(search: string): CompareUrlState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  const entitiesRaw = params.get("entities");
  const entityIds: string[] = [];
  if (typeof entitiesRaw === "string" && entitiesRaw.length > 0) {
    for (const part of entitiesRaw.split(",")) {
      const trimmed = part.trim();
      if (trimmed.length === 0) continue;
      const parsed = EntityIdSchema.safeParse(trimmed);
      if (parsed.success && !entityIds.includes(parsed.data)) {
        entityIds.push(parsed.data);
      }
      if (entityIds.length >= MAX_COMPARE_ENTITIES) break;
    }
  }

  const startRaw = params.get("start");
  let startYear = DEFAULT_START_YEAR;
  if (typeof startRaw === "string") {
    const parsed = YearSchema.safeParse(startRaw);
    if (parsed.success) startYear = parsed.data;
  }

  const endRaw = params.get("end");
  let endYear = DEFAULT_END_YEAR;
  if (typeof endRaw === "string") {
    const parsed = YearSchema.safeParse(endRaw);
    if (parsed.success) endYear = parsed.data;
  }

  if (endYear < startYear) {
    [startYear, endYear] = [endYear, startYear];
  }

  const modeRaw = params.get("mode");
  let mode: CompareMode = DEFAULT_MODE;
  if (typeof modeRaw === "string") {
    const parsed = CompareModeSchema.safeParse(modeRaw);
    if (parsed.success) mode = parsed.data;
  }

  const unitRaw = params.get("unit");
  let unit: CompareUnit = DEFAULT_UNIT;
  if (typeof unitRaw === "string") {
    const parsed = CompareUnitSchema.safeParse(unitRaw);
    if (parsed.success) unit = parsed.data;
  }

  const baseRaw = params.get("baseYear");
  let baseYear = DEFAULT_BASE_YEAR;
  if (typeof baseRaw === "string") {
    const parsed = YearSchema.safeParse(baseRaw);
    if (parsed.success) baseYear = parsed.data;
  }

  const originalLabelsRaw = params.get("originalLabels");
  const originalLabels =
    typeof originalLabelsRaw === "string" ? originalLabelsRaw === "1" : DEFAULT_ORIGINAL_LABELS;

  const stageRaw = params.get("stage");
  let stageFilter: string | null = DEFAULT_STAGE_FILTER;
  if (typeof stageRaw === "string" && stageRaw.length > 0) {
    stageFilter = stageRaw;
  }

  return { entityIds, startYear, endYear, mode, unit, baseYear, originalLabels, stageFilter };
}

export function serializeCompareUrl(state: CompareUrlState): string {
  const params = new URLSearchParams();
  const limited = state.entityIds.slice(0, MAX_COMPARE_ENTITIES);
  if (limited.length > 0) {
    params.set("entities", limited.join(","));
  }
  params.set("start", String(state.startYear));
  params.set("end", String(state.endYear));
  params.set("mode", state.mode);
  params.set("unit", state.unit);
  params.set("baseYear", String(state.baseYear));
  if (state.originalLabels) {
    params.set("originalLabels", "1");
  }
  if (state.stageFilter !== null) {
    params.set("stage", state.stageFilter);
  }
  return `?${params.toString()}`;
}
