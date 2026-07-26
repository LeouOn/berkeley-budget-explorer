import { z } from "zod";
import { SemverSchema, SourceIdSchema } from "../sources/manifest";

export const StageSchema = z.enum(["proposed", "adopted", "revised", "projected", "actual"]);
export type Stage = z.infer<typeof StageSchema>;

export const BasisSchema = z.enum(["budgetary", "gaap", "modified-accrual", "unknown"]);
export type Basis = z.infer<typeof BasisSchema>;

export const EntityTypeSchema = z.enum([
  "service",
  "department",
  "fund",
  "program",
  "revenue-category",
  "expense-category",
  "capital-project",
]);
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const ExtractionMethodSchema = z.enum([
  "api",
  "structured-table",
  "manual-transcription",
  "pdf-extraction",
]);
export type ExtractionMethod = z.infer<typeof ExtractionMethodSchema>;

export const ConfidenceSchema = z.enum(["verified", "review-required", "excluded"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ComparabilitySchema = z.enum([
  "exact",
  "reconstructed",
  "approximate",
  "incompatible",
]);
export type Comparability = z.infer<typeof ComparabilitySchema>;

export const EntityIdSchema = z.string().regex(/^ent-[a-z0-9-]+$/);
export type EntityId = z.infer<typeof EntityIdSchema>;

export const FiscalYearSchema = z.number().int().min(1900).max(2100);

export const BudgetValueSchema = z.object({
  fiscalYear: FiscalYearSchema,
  amountNominalCents: z.number().int(),
  stage: StageSchema,
  basis: BasisSchema,
  entityId: EntityIdSchema,
  entityType: EntityTypeSchema,
  sourceId: SourceIdSchema,
  sourceLabel: z.string().min(1),
  extractionMethod: ExtractionMethodSchema,
  confidence: ConfidenceSchema,
  schemaVersion: SemverSchema,
});
export type BudgetValue = z.infer<typeof BudgetValueSchema>;

export const EntitySchema = z.object({
  id: EntityIdSchema,
  type: EntityTypeSchema,
  canonicalName: z.string().min(1),
  plainDescription: z.string().min(1),
  parentId: EntityIdSchema.optional(),
  serviceKey: z
    .string()
    .regex(/^svc-[a-z0-9-]+$/)
    .optional(),
});
export type Entity = z.infer<typeof EntitySchema>;

const CardinalitySchema = z.enum(["one-to-one", "many-to-one", "partial"]);

export const CrosswalkEntrySchema = z
  .object({
    sourceEntityKey: z.string().min(1),
    canonicalEntityId: EntityIdSchema,
    effectiveStart: FiscalYearSchema,
    effectiveEnd: FiscalYearSchema,
    rationale: z.string().min(1),
    cardinality: CardinalitySchema,
    comparability: ComparabilitySchema,
    reviewer: z.string().min(1),
    reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((e) => e.effectiveEnd >= e.effectiveStart, {
    message: "effectiveEnd must be >= effectiveStart",
  });
export type CrosswalkEntry = z.infer<typeof CrosswalkEntrySchema>;
