import { readFile } from "node:fs/promises";
import { z } from "zod";
import { type CpiObservation, CpiObservationSchema, EXPECTED_SERIES_ID } from "./bls-cpi";
import { SourceManifestSchema } from "./manifest";
import manifestData from "./manifest.data.json" with { type: "json" };

const BlsRawRowSchema = z.object({
  year: z.string().regex(/^\d{4}$/),
  period: z.string().regex(/^M(0[1-9]|1[0-2])$/),
  value: z.string(),
  latest: z.string().optional(),
  periodName: z.string().optional(),
  footnotes: z.array(z.unknown()).optional(),
});

export function parseBlsSnapshot(raw: unknown): readonly CpiObservation[] {
  const response = z
    .object({
      Results: z.object({
        seriesID: z.string(),
        data: z.array(BlsRawRowSchema),
      }),
    })
    .parse(raw);
  if (response.Results.seriesID !== EXPECTED_SERIES_ID) {
    throw new Error(
      `BlsResponse must carry seriesID "${EXPECTED_SERIES_ID}" (got "${response.Results.seriesID}")`,
    );
  }
  return response.Results.data
    .filter((row) => /^-?\d+(\.\d+)?$/.test(row.value))
    .map((row) => ({
      year: Number.parseInt(row.year, 10),
      month: Number.parseInt(row.period.slice(1), 10),
      value: Number.parseFloat(row.value),
    }));
}

export function parseCpiObservations(body: unknown): readonly CpiObservation[] {
  return parseBlsSnapshot(body);
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
