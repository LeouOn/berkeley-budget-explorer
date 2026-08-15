import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type SourceEntry, type SourceManifest, SourceManifestSchema } from "./manifest";

export function readManifestFromDisk(path: string): Promise<SourceManifest> {
  return readFile(path, "utf-8").then((text) => SourceManifestSchema.parse(JSON.parse(text)));
}

export function sha256Of(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export type VerifyResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export function verifySnapshot(entry: SourceEntry, bytes: Buffer): VerifyResult {
  const actual = sha256Of(bytes);
  if (actual !== entry.checksumSha256) {
    return {
      ok: false,
      reason: `checksum mismatch (expected ${entry.checksumSha256}, got ${actual})`,
    };
  }
  return { ok: true };
}

export interface LoadSnapshotInput {
  readonly root: string;
  readonly entry: SourceEntry;
  readonly releaseId: string;
}

export type LoadSnapshotResult =
  | { readonly ok: true; readonly bytes: Buffer; readonly path: string }
  | { readonly ok: false; readonly reason: string };

export async function loadSnapshot(input: LoadSnapshotInput): Promise<LoadSnapshotResult> {
  const path = resolve(input.root, input.entry.id, `${input.releaseId}.json`);
  const bytes = await readFile(path);
  const v = verifySnapshot(input.entry, bytes);
  if (!v.ok) return { ok: false, reason: v.reason };
  return { ok: true, bytes, path };
}
