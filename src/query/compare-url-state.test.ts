import { describe, expect, it } from "vitest";
import {
  DEFAULT_BASE_YEAR,
  DEFAULT_END_YEAR,
  DEFAULT_MODE,
  DEFAULT_ORIGINAL_LABELS,
  DEFAULT_START_YEAR,
  DEFAULT_UNIT,
  MAX_COMPARE_ENTITIES,
  parseCompareUrl,
  serializeCompareUrl,
} from "./compare-url-state";

describe("compare url state", () => {
  it("defaults to empty entities, 2003-2024, real, absolute, base 2024 when params absent", () => {
    expect(parseCompareUrl("")).toEqual({
      entityIds: [],
      startYear: DEFAULT_START_YEAR,
      endYear: DEFAULT_END_YEAR,
      mode: DEFAULT_MODE,
      unit: DEFAULT_UNIT,
      baseYear: DEFAULT_BASE_YEAR,
      originalLabels: DEFAULT_ORIGINAL_LABELS,
    });
  });

  it("parses comma-separated entity ids", () => {
    const parsed = parseCompareUrl("?entities=ent-sco-cat-public-safety,ent-sco-cat-health");
    expect(parsed.entityIds).toEqual(["ent-sco-cat-public-safety", "ent-sco-cat-health"]);
  });

  it("limits to MAX_COMPARE_ENTITIES entity ids", () => {
    const many = Array.from({ length: MAX_COMPARE_ENTITIES + 2 }, (_, i) =>
      `ent-sco-cat-entity-${i}`.replace(/(\d+)$/, (m) => m),
    ).join(",");
    const parsed = parseCompareUrl(`?entities=${many}`);
    expect(parsed.entityIds.length).toBeLessThanOrEqual(MAX_COMPARE_ENTITIES);
  });

  it("rejects invalid entity id formats and keeps valid ones", () => {
    const parsed = parseCompareUrl("?entities=invalid-id,ent-sco-cat-valid");
    expect(parsed.entityIds).toEqual(["ent-sco-cat-valid"]);
  });

  it("rejects unknown mode values and falls back to real", () => {
    const parsed = parseCompareUrl("?mode=hyper");
    expect(parsed.mode).toBe("real");
  });

  it("rejects unknown unit values and falls back to absolute", () => {
    const parsed = parseCompareUrl("?unit=bogus");
    expect(parsed.unit).toBe("absolute");
  });

  it("coerces valid year params", () => {
    const parsed = parseCompareUrl("?start=2010&end=2020&baseYear=2018");
    expect(parsed.startYear).toBe(2010);
    expect(parsed.endYear).toBe(2020);
    expect(parsed.baseYear).toBe(2018);
  });

  it("swaps start and end if end precedes start", () => {
    const parsed = parseCompareUrl("?start=2020&end=2010");
    expect(parsed.startYear).toBe(2010);
    expect(parsed.endYear).toBe(2020);
  });

  it("deduplicates entity ids", () => {
    const parsed = parseCompareUrl("?entities=ent-sco-cat-public-safety,ent-sco-cat-public-safety");
    expect(parsed.entityIds).toEqual(["ent-sco-cat-public-safety"]);
  });

  it("round-trips through serialize", () => {
    const state = {
      entityIds: ["ent-sco-cat-public-safety", "ent-sco-cat-health"],
      startYear: 2015,
      endYear: 2022,
      mode: "nominal" as const,
      unit: "per-resident" as const,
      baseYear: 2020,
      originalLabels: false,
    };
    const serialized = serializeCompareUrl(state);
    const parsed = parseCompareUrl(serialized);
    expect(parsed).toEqual(state);
  });

  it("serializes with all expected params", () => {
    const serialized = serializeCompareUrl({
      entityIds: ["ent-sco-cat-public-safety"],
      startYear: 2019,
      endYear: 2024,
      mode: "real",
      unit: "absolute",
      baseYear: 2024,
      originalLabels: false,
    });
    expect(serialized).toContain("entities=ent-sco-cat-public-safety");
    expect(serialized).toContain("start=2019");
    expect(serialized).toContain("end=2024");
    expect(serialized).toContain("mode=real");
    expect(serialized).toContain("unit=absolute");
    expect(serialized).toContain("baseYear=2024");
  });

  it("parses originalLabels=1 as true", () => {
    const parsed = parseCompareUrl("?originalLabels=1");
    expect(parsed.originalLabels).toBe(true);
  });

  it("parses originalLabels=0 as false", () => {
    const parsed = parseCompareUrl("?originalLabels=0");
    expect(parsed.originalLabels).toBe(false);
  });

  it("serializes originalLabels flag only when true", () => {
    const withLabels = serializeCompareUrl({
      entityIds: [],
      startYear: 2019,
      endYear: 2024,
      mode: "real",
      unit: "absolute",
      baseYear: 2024,
      originalLabels: true,
    });
    expect(withLabels).toContain("originalLabels=1");
    const withoutLabels = serializeCompareUrl({
      entityIds: [],
      startYear: 2019,
      endYear: 2024,
      mode: "real",
      unit: "absolute",
      baseYear: 2024,
      originalLabels: false,
    });
    expect(withoutLabels).not.toContain("originalLabels");
  });

  it("round-trips originalLabels through serialize/parse", () => {
    const state = {
      entityIds: ["ent-acfr-gov-funds-total-revenue"],
      startYear: 2025,
      endYear: 2025,
      mode: "nominal" as const,
      unit: "absolute" as const,
      baseYear: 2024,
      originalLabels: true,
    };
    expect(parseCompareUrl(serializeCompareUrl(state))).toEqual(state);
  });
});
