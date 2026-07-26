import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

export const SourceIdSchema = z.string().regex(/^src-[a-z0-9-]+$/, {
  message: "source id must match ^src-[a-z0-9-]+$",
});
export type SourceId = z.infer<typeof SourceIdSchema>;

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const SemverSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

export const Sha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .refine((v) => v !== "0".repeat(64), {
    message: "checksum must not be the all-zero placeholder",
  });

export const FiscalPeriodSchema = z
  .object({
    start: z.number().int().min(1900).max(2100),
    end: z.number().int().min(1900).max(2100),
  })
  .refine((p) => p.end >= p.start);

export const SourceEntrySchema = z.object({
  id: SourceIdSchema,
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z
    .string()
    .url()
    .refine((u) => /\/(resource|publicAPI|api)\//.test(u) || /\.pdf$/i.test(u), {
      message: "url must be an API endpoint containing /resource/ or /api/, or a .pdf document",
    }),
  identityField: z.string().min(1),
  expectedIdentity: z.string().min(1),
  retrievedAt: IsoDateSchema,
  checksumSha256: Sha256Schema,
  parserVersion: SemverSchema,
  fiscalPeriods: z.array(FiscalPeriodSchema).min(1),
  notes: z.string().optional(),
});
export type SourceEntry = z.infer<typeof SourceEntrySchema>;

export const SourceManifestSchema = z
  .object({
    releaseId: z.string().regex(/^rel-\d{4}-\d{2}-\d{2}-[a-z0-9]+$/),
    generatedAt: IsoDateTimeSchema,
    schemaVersion: SemverSchema,
    sources: z.array(SourceEntrySchema),
  })
  .refine((m) => m.sources.length >= 5, {
    message: "manifest must contain at least five sources",
  });
export type SourceManifest = z.infer<typeof SourceManifestSchema>;

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
