import { readFile } from "node:fs/promises";
import { z } from "zod";
import { SourceManifestSchema } from "./manifest";
import manifestData from "./manifest.data.json" with { type: "json" };

export const EXPECTED_SERIES_ID = "CUURA422SA0";

export const CpiObservationSchema = z.object({
  year: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12),
  value: z.number().positive(),
});
export type CpiObservation = z.infer<typeof CpiObservationSchema>;

const BlsDataRowSchema = z.object({
  year: z.string().regex(/^\d{4}$/),
  period: z.string().regex(/^M(0[1-9]|1[0-2])$/),
  value: z.string().regex(/^-?\d+(\.\d+)?$/),
  latest: z.string().optional(),
  periodName: z.string().optional(),
  footnotes: z.array(z.unknown()).optional(),
});

// BLS publishes "-" for unavailable observations (e.g. 2025 lapse in
// appropriations). The raw schema rejects those because the value is not
// numeric; this schema accepts the full response shape so the snapshot can
// be validated, and parseBlsSnapshot filters non-numeric rows.
const BlsRawRowSchema = z.object({
  year: z.string().regex(/^\d{4}$/),
  period: z.string().regex(/^M(0[1-9]|1[0-2])$/),
  value: z.string(),
  latest: z.string().optional(),
  periodName: z.string().optional(),
  footnotes: z.array(z.unknown()).optional(),
});

export const BlsResponseSchema = z
  .object({
    Results: z.object({
      seriesID: z.string(),
      data: z.array(BlsRawRowSchema),
    }),
  })
  .refine((r) => r.Results.seriesID === EXPECTED_SERIES_ID, {
    message: `BlsResponse must carry seriesID "${EXPECTED_SERIES_ID}"`,
  });
export type BlsResponse = z.infer<typeof BlsResponseSchema>;

export const FiscalYearAverageSchema = z.object({
  fiscalYear: z.number().int().min(1900).max(2100),
  averageIndex: z.number().positive(),
  observationCount: z.number().int().min(0).max(6),
});
export type FiscalYearAverage = z.infer<typeof FiscalYearAverageSchema>;

export const MIN_COVERAGE = 6;

export class BlsCoverageIncompleteError extends Error {
  constructor(
    public readonly fiscalYear: number,
    public readonly observationCount: number,
  ) {
    super(
      `BLS coverage incomplete for fiscal year ${fiscalYear}: ${observationCount} observations (minimum ${MIN_COVERAGE})`,
    );
    this.name = "BlsCoverageIncompleteError";
  }
}

export function parseBlsSnapshot(raw: unknown): readonly CpiObservation[] {
  const response = BlsResponseSchema.parse(raw);
  return response.Results.data
    .filter((row) => /^-?\d+(\.\d+)?$/.test(row.value))
    .map((row) => ({
      year: Number.parseInt(row.year, 10),
      month: Number.parseInt(row.period.slice(1), 10),
      value: Number.parseFloat(row.value),
    }));
}

export function fiscalYearOf(month: number, year: number): number {
  return month >= 7 ? year + 1 : year;
}

export function fiscalYearAverage(
  observations: readonly CpiObservation[],
): readonly FiscalYearAverage[] {
  const buckets = new Map<number, number[]>();
  for (const obs of observations) {
    const fy = fiscalYearOf(obs.month, obs.year);
    const list = buckets.get(fy) ?? [];
    list.push(obs.value);
    buckets.set(fy, list);
  }
  const result: FiscalYearAverage[] = [];
  for (const [fy, values] of [...buckets.entries()].sort(([a], [b]) => a - b)) {
    if (values.length === 0) continue;
    const sum = values.reduce((acc, v) => acc + v, 0);
    result.push({
      fiscalYear: fy,
      averageIndex: sum / values.length,
      observationCount: values.length,
    });
  }
  return result;
}

export function factorFor(
  averages: readonly FiscalYearAverage[],
  baseYear: number,
  targetYear: number,
): number {
  const base = averages.find((a) => a.fiscalYear === baseYear);
  const target = averages.find((a) => a.fiscalYear === targetYear);
  if (!base) {
    throw new BlsCoverageIncompleteError(baseYear, 0);
  }
  if (!target) {
    throw new BlsCoverageIncompleteError(targetYear, 0);
  }
  if (base.observationCount < MIN_COVERAGE) {
    throw new BlsCoverageIncompleteError(baseYear, base.observationCount);
  }
  if (target.observationCount < MIN_COVERAGE) {
    throw new BlsCoverageIncompleteError(targetYear, target.observationCount);
  }
  return target.averageIndex / base.averageIndex;
}

export function latestCompleteFiscalYear(
  averages: readonly FiscalYearAverage[],
  minObservations: number,
): number {
  const qualifying = averages.filter((a) => a.observationCount >= minObservations);
  if (qualifying.length === 0) throw new Error("No fiscal year meets the coverage floor");
  return Math.max(...qualifying.map((a) => a.fiscalYear));
}

export function parseCpiObservations(body: unknown): readonly CpiObservation[] {
  return parseBlsSnapshot(body);
}

export function inflateCents(
  nominalCents: number,
  targetYear: number,
  baseYear: number,
  averages: readonly FiscalYearAverage[],
): number {
  const factor = factorFor(averages, targetYear, baseYear);
  return Math.round(nominalCents * factor);
}

export async function loadBlsFromSnapshot(
  root: string,
  releaseId: string,
): Promise<readonly CpiObservation[]> {
  const manifest = SourceManifestSchema.parse(manifestData);
  const entry = manifest.sources.find((s) => s.id === "src-bls-cpi-u-cuura422sa0");
  if (!entry) throw new Error("BLS entry missing from manifest");
  const path = `${root}/${entry.id}/${releaseId}.json`;
  const bytes = await readFile(path);
  const expected = entry.checksumSha256;
  const { createHash } = await import("node:crypto");
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) {
    throw new Error(`BLS snapshot checksum mismatch (expected ${expected}, got ${actual})`);
  }
  return parseCpiObservations(JSON.parse(bytes.toString("utf-8")));
}
