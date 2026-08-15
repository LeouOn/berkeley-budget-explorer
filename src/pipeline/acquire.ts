import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type SourceEntry, SourceEntrySchema, SourceManifestSchema } from "./sources/manifest";
import { sha256Of } from "./sources/manifest-node";
import manifestData from "./sources/manifest.data.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_ROOT = resolve(__dirname, "../../data/snapshots");
const CACHE_ROOT = resolve(__dirname, "../../.artifacts-cache");
const RELEASE_ID = SourceManifestSchema.parse(manifestData).releaseId;

export interface AcquisitionResult {
  readonly sourceId: string;
  readonly bytes: Buffer;
  readonly checksumSha256: string;
  readonly snapshotPath: string;
  readonly sidecarPath: string;
}

export type SourceIdentityKind = "bls-series-id" | "dataset-id-from-url" | "berkeley-entity-scope";

// Identity rule per source. Each entry maps a source id to a check strategy:
//   1. dataset identity: BLS checks the body series id; Socrata and the three
//      SCO endpoints check the pinned dataset id that the manifest pins inside
//      the source URL.
//   2. entity scope: array payloads must contain at least one Berkeley row
//      (entity_name === "Berkeley" or "City of Berkeley"; the SCO per-capita
//      datasets publish "Berkeley" while detailed expenditures may use either).
export const SOURCE_IDENTITY_RULES: Readonly<Record<string, SourceIdentityKind>> = {
  "src-bls-cpi-u-cuura422sa0": "bls-series-id",
  "src-berkeley-socrata-gy8t-iqc4": "berkeley-entity-scope",
  "src-sco-expenditures-ju3w-4gxp": "dataset-id-from-url",
  "src-sco-expenditures-per-capita-ykhf-vfsr": "dataset-id-from-url",
  "src-sco-revenues-per-capita-ky7j-fsk5": "dataset-id-from-url",
};

const DATASET_ID_FROM_URL: Readonly<Record<string, string>> = {
  "src-sco-expenditures-ju3w-4gxp": "ju3w-4gxp",
  "src-sco-expenditures-per-capita-ykhf-vfsr": "ykhf-vfsr",
  "src-sco-revenues-per-capita-ky7j-fsk5": "ky7j-fsk5",
  "src-berkeley-socrata-gy8t-iqc4": "gy8t-iqc4",
};

function readIdentityField(body: unknown, dottedPath: string): unknown {
  const parts = dottedPath.split(".");
  let cursor: unknown = body;
  for (const part of parts) {
    if (cursor === null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

// Read a JSON-array body. Returns an empty array for a non-array.
function asArray(body: unknown): readonly unknown[] {
  return Array.isArray(body) ? body : [];
}

// Returns true when the entity name identifies Berkeley. The SCO per-capita
// datasets publish entity_name as "Berkeley"; detailed expenditures may use
// "City of Berkeley". Both are accepted.
function isBerkeleyEntity(entityName: unknown): boolean {
  return entityName === "City of Berkeley" || entityName === "Berkeley";
}

export function verifySourceIdentity(
  sourceId: SourceEntry["id"],
  body: unknown,
  url: string,
): void {
  const rule = SOURCE_IDENTITY_RULES[sourceId];
  if (!rule) {
    throw new Error(`No identity rule registered for source ${sourceId}`);
  }
  switch (rule) {
    case "bls-series-id": {
      const observed = readIdentityField(body, "Results.seriesID");
      if (observed !== "CUURA422SA0") {
        throw new Error(
          `Identity mismatch for ${sourceId}: expected Results.seriesID === "CUURA422SA0", observed ${String(observed)}`,
        );
      }
      return;
    }
    case "dataset-id-from-url": {
      const expectedDatasetId = DATASET_ID_FROM_URL[sourceId];
      if (!expectedDatasetId) {
        throw new Error(`No pinned dataset id for ${sourceId}`);
      }
      const parsed = new URL(url);
      const segments = parsed.pathname.split("/").filter((s) => s.length > 0);
      const last = segments[segments.length - 1] ?? "";
      const datasetIdInUrl = last.replace(/\.json$/, "");
      if (datasetIdInUrl !== expectedDatasetId) {
        throw new Error(
          `Identity mismatch for ${sourceId}: manifest URL does not contain pinned dataset id ${expectedDatasetId} (got ${datasetIdInUrl || "<empty>"})`,
        );
      }
      const rows = asArray(body);
      if (rows.length === 0) {
        throw new Error(
          `Identity mismatch for ${sourceId}: empty body, expected at least one Berkeley row`,
        );
      }
      const hasBerkeley = rows.some((r) => {
        if (r === null || typeof r !== "object") return false;
        return isBerkeleyEntity((r as Record<string, unknown>).entity_name);
      });
      if (!hasBerkeley) {
        throw new Error(`Identity mismatch for ${sourceId}: no row carries a Berkeley entity_name`);
      }
      return;
    }
    case "berkeley-entity-scope": {
      const parsed = new URL(url);
      const segments = parsed.pathname.split("/").filter((s) => s.length > 0);
      const last = segments[segments.length - 1] ?? "";
      const datasetIdInUrl = last.replace(/\.json$/, "");
      if (datasetIdInUrl !== DATASET_ID_FROM_URL["src-berkeley-socrata-gy8t-iqc4"]) {
        throw new Error(
          `Identity mismatch for ${sourceId}: manifest URL does not contain pinned dataset id gy8t-iqc4 (got ${datasetIdInUrl || "<empty>"})`,
        );
      }
      return;
    }
    default: {
      const _exhaustive: never = rule;
      throw new Error(`Unhandled identity rule: ${String(_exhaustive)}`);
    }
  }
}

export function canonicalize(body: unknown): Buffer {
  return Buffer.from(JSON.stringify(body, canonicalReplacer), "utf-8");
}

function canonicalReplacer(_key: string, value: unknown): unknown {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }
  return value;
}

export async function acquireSource(entry: SourceEntry): Promise<AcquisitionResult> {
  const parsed = SourceEntrySchema.parse(entry);
  const response = await fetch(parsed.url, {
    headers: { Accept: "application/json", "User-Agent": "berkeley-budget-explorer/1.0" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${parsed.url}`);
  }
  const body = JSON.parse(await response.text()) as unknown;
  verifySourceIdentity(parsed.id, body, parsed.url);
  const bytes = canonicalize(body);
  const checksum = sha256Of(bytes);
  if (checksum === "0".repeat(64)) {
    throw new Error(`Computed all-zero checksum for ${parsed.id}; refusing to write snapshot`);
  }
  const targetDir = resolve(CACHE_ROOT, parsed.id);
  await mkdir(targetDir, { recursive: true });
  const snapshotPath = resolve(targetDir, `${RELEASE_ID}.json`);
  const sidecarPath = resolve(targetDir, `${RELEASE_ID}.sha256`);
  await writeFile(snapshotPath, bytes, "utf-8");
  await writeFile(sidecarPath, `${checksum}\n`, "utf-8");
  return { sourceId: parsed.id, bytes, checksumSha256: checksum, snapshotPath, sidecarPath };
}

async function commitSnapshot(result: AcquisitionResult): Promise<void> {
  const targetDir = resolve(SNAPSHOT_ROOT, result.sourceId);
  await mkdir(targetDir, { recursive: true });
  const finalSnapshot = resolve(targetDir, `${RELEASE_ID}.json`);
  const finalSidecar = resolve(targetDir, `${RELEASE_ID}.sha256`);
  await rename(result.snapshotPath, finalSnapshot);
  await rename(result.sidecarPath, finalSidecar);
}

export async function acquireAll(): Promise<void> {
  const manifest = SourceManifestSchema.parse(manifestData);
  const results: AcquisitionResult[] = [];
  try {
    for (const entry of manifest.sources) {
      const result = await acquireSource(entry);
      results.push(result);
    }
  } catch (err) {
    throw new Error(
      `Acquisition failed; existing snapshots at ${SNAPSHOT_ROOT} are untouched. ${(err as Error).message}`,
    );
  }
  for (const result of results) await commitSnapshot(result);
  console.log(`Acquired ${results.length} snapshots for release ${RELEASE_ID}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  acquireAll().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
