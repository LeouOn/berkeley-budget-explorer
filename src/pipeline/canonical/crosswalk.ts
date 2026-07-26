import { z } from "zod";
import { type CrosswalkEntry, type Entity, EntitySchema } from "./schema";

const CrosswalkFileSchema = z.object({
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  entries: z.array(
    z.object({
      sourceEntityKey: z.string().min(1),
      canonicalEntityId: z.string().regex(/^ent-[a-z0-9-]+$/),
      effectiveStart: z.number().int().min(1900).max(2100),
      effectiveEnd: z.number().int().min(1900).max(2100),
      rationale: z.string().min(1),
      cardinality: z.enum(["one-to-one", "many-to-one", "partial"]),
      comparability: z.enum(["exact", "reconstructed", "approximate", "incompatible"]),
      reviewer: z.string().min(1),
      reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  ),
});

export function loadCrosswalk(raw: unknown): readonly CrosswalkEntry[] {
  const file = CrosswalkFileSchema.parse(raw);
  return file.entries;
}

export function resolveEntityId(
  entries: readonly CrosswalkEntry[],
  sourceEntityKey: string,
  fiscalYear: number,
): string | undefined {
  for (const entry of entries) {
    if (entry.sourceEntityKey !== sourceEntityKey) continue;
    if (fiscalYear >= entry.effectiveStart && fiscalYear <= entry.effectiveEnd) {
      return entry.canonicalEntityId;
    }
  }
  return undefined;
}

export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly string[] };

export function validateCrosswalk(
  entries: readonly CrosswalkEntry[],
  entities: readonly Entity[],
): ValidationResult {
  const errors: string[] = [];
  const entityIds = new Set(entities.map((e) => e.id));
  for (const entry of entries) {
    if (!entityIds.has(entry.canonicalEntityId)) {
      errors.push(
        `Crosswalk entry references unknown entity ${entry.canonicalEntityId} (source=${entry.sourceEntityKey})`,
      );
    }
  }
  const bySource = new Map<string, CrosswalkEntry[]>();
  for (const entry of entries) {
    const list = bySource.get(entry.sourceEntityKey) ?? [];
    list.push(entry);
    bySource.set(entry.sourceEntityKey, list);
  }
  for (const [key, list] of bySource) {
    const sorted = [...list].sort((a, b) => a.effectiveStart - b.effectiveStart);
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (!current || !next) continue;
      if (next.effectiveStart <= current.effectiveEnd) {
        errors.push(
          `Crosswalk overlap for ${key}: ${current.effectiveStart}-${current.effectiveEnd} overlaps ${next.effectiveStart}-${next.effectiveEnd}`,
        );
      }
    }
  }
  EntitySchema.array().parse(entities);
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
