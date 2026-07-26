import { describe, expect, it } from "vitest";
import {
  BasisSchema,
  BudgetValueSchema,
  ComparabilitySchema,
  ConfidenceSchema,
  CrosswalkEntrySchema,
  EntitySchema,
  EntityTypeSchema,
  ExtractionMethodSchema,
  StageSchema,
} from "./schema";

const baseValue = {
  fiscalYear: 2024,
  amountNominalCents: 123456_00,
  stage: "actual" as const,
  basis: "gaap" as const,
  entityId: "ent-service-streets",
  entityType: "service" as const,
  sourceId: "src-sco-expenditures-per-capita-ykhf-vfsr",
  sourceLabel: "City of Berkeley total expenditures (per-capita dataset, FY2024)",
  extractionMethod: "api" as const,
  confidence: "verified" as const,
  schemaVersion: "1.0.0",
};

describe("canonical schema", () => {
  it("accepts a complete BudgetValue", () => {
    expect(() => BudgetValueSchema.parse(baseValue)).not.toThrow();
  });

  it("rejects an unknown stage", () => {
    expect(() => StageSchema.parse("forecast")).toThrow();
  });

  it("rejects an unknown entity type", () => {
    expect(() => EntityTypeSchema.parse("neighborhood")).toThrow();
  });

  it("rejects an unknown extraction method", () => {
    expect(() => ExtractionMethodSchema.parse("scraped")).toThrow();
  });

  it("rejects an unknown confidence", () => {
    expect(() => ConfidenceSchema.parse("maybe")).toThrow();
  });

  it("rejects an unknown comparability level", () => {
    expect(() => ComparabilitySchema.parse("close")).toThrow();
  });

  it("rejects an unknown basis", () => {
    expect(() => BasisSchema.parse("cash")).toThrow();
  });

  it("accepts a valid Entity with optional parentId", () => {
    expect(() =>
      EntitySchema.parse({
        id: "ent-service-streets",
        type: "service",
        canonicalName: "Streets and Sidewalks",
        plainDescription: "Roadway maintenance and paving programs.",
        parentId: "ent-department-public-works",
        serviceKey: "svc-streets",
      }),
    ).not.toThrow();
  });

  it("rejects a CrosswalkEntry whose effectiveEnd precedes effectiveStart", () => {
    expect(() =>
      CrosswalkEntrySchema.parse({
        sourceEntityKey: "socrata:department:Public Works",
        canonicalEntityId: "ent-department-public-works",
        effectiveStart: 2015,
        effectiveEnd: 2012,
        rationale: "Pre-reorg coverage.",
        cardinality: "one-to-one",
        comparability: "exact",
        reviewer: "pipeline-bot",
        reviewedAt: "2026-07-20",
      }),
    ).toThrow();
  });
});
