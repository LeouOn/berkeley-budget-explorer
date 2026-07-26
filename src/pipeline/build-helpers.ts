import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type SourceEntry,
  type SourceManifest,
  SourceManifestSchema,
  sha256Of,
} from "./sources/manifest";
import manifestData from "./sources/manifest.data.json" with { type: "json" };

export function getManifest(): SourceManifest {
  return SourceManifestSchema.parse(manifestData);
}

export function requireEntry(id: string): SourceEntry {
  const manifest = getManifest();
  const entry = manifest.sources.find((s) => s.id === id);
  if (!entry) throw new Error(`Manifest missing required source id ${id}`);
  return entry;
}

export function loadVerifiedSnapshot(
  snapshotRoot: string,
  entry: SourceEntry,
  releaseId: string,
): unknown {
  const path = resolve(snapshotRoot, entry.id, `${releaseId}.json`);
  const bytes = readFileSync(path);
  const checksum = sha256Of(bytes);
  if (checksum !== entry.checksumSha256) {
    throw new Error(
      `Snapshot checksum mismatch for ${entry.id}: expected ${entry.checksumSha256}, got ${checksum}`,
    );
  }
  return JSON.parse(bytes.toString("utf-8"));
}

export function loadVerifiedSource(
  snapshotRoot: string,
  entry: SourceEntry,
  releaseId: string,
): readonly unknown[] {
  const parsed = loadVerifiedSnapshot(snapshotRoot, entry, releaseId);
  if (!Array.isArray(parsed)) {
    throw new Error(`Snapshot for ${entry.id} must be a JSON array; got ${typeof parsed}`);
  }
  return parsed;
}
