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
