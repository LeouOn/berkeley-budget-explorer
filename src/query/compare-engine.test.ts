import { describe, expect, it } from "vitest";
import type { BudgetValue, Entity } from "../pipeline/canonical/schema";
import type { PopulationObservation } from "../pipeline/derive/derive";
import { fiscalYearAverage } from "../pipeline/sources/bls-cpi";
import { parseCpiObservations } from "../pipeline/sources/bls-cpi-node";
import { blsFixture } from "../pipeline/sources/bls-cpi.fixtures";
import { MAX_COMPARE_ENTITIES, compareSeries } from "./compare-engine";

const SOURCE_ID = "src-sco-expenditures-ju3w-4gxp";

const entities: readonly Entity[] = [
  {
    id: "ent-sco-cat-public-safety",
    type: "expense-category",
    canonicalName: "Public Safety",
    plainDescription: "SCO detailed expenditure category: Public Safety.",
  },
  {
    id: "ent-sco-cat-health",
    type: "expense-category",
    canonicalName: "Health",
    plainDescription: "SCO detailed expenditure category: Health.",
  },
  {
    id: "ent-sco-cat-general-government",
    type: "expense-category",
    canonicalName: "General Government",
    plainDescription: "SCO detailed expenditure category: General Government.",
  },
  {
    id: "ent-sco-cat-transportation",
    type: "expense-category",
    canonicalName: "Transportation",
    plainDescription: "SCO detailed expenditure category: Transportation.",
  },
  {
    id: "ent-sco-cat-culture-and-leisure",
    type: "expense-category",
    canonicalName: "Culture and Leisure",
    plainDescription: "SCO detailed expenditure category: Culture and Leisure.",
  },
];

function makeValue(entityId: string, fiscalYear: number, amountCents: number): BudgetValue {
  return {
    fiscalYear,
    amountNominalCents: amountCents,
    stage: "actual",
    basis: "gaap",
    entityId,
    entityType: "expense-category",
    sourceId: SOURCE_ID,
    sourceLabel: `Berkeley test (${entityId}, FY${fiscalYear})`,
    extractionMethod: "api",
    confidence: "verified",
    schemaVersion: "1.0.0",
  };
}

const values: readonly BudgetValue[] = [
  makeValue("ent-sco-cat-public-safety", 2019, 50_000_00),
  makeValue("ent-sco-cat-public-safety", 2020, 52_000_00),
  makeValue("ent-sco-cat-public-safety", 2021, 54_000_00),
  makeValue("ent-sco-cat-public-safety", 2022, 56_000_00),
  makeValue("ent-sco-cat-public-safety", 2023, 58_000_00),
  makeValue("ent-sco-cat-public-safety", 2024, 60_000_00),
  makeValue("ent-sco-cat-health", 2019, 20_000_00),
  makeValue("ent-sco-cat-health", 2020, 21_000_00),
  makeValue("ent-sco-cat-health", 2021, 22_000_00),
  makeValue("ent-sco-cat-health", 2022, 23_000_00),
  makeValue("ent-sco-cat-health", 2023, 24_000_00),
  makeValue("ent-sco-cat-health", 2024, 25_000_00),
  makeValue("ent-sco-cat-transportation", 2019, 10_000_00),
  makeValue("ent-sco-cat-transportation", 2020, 10_500_00),
  makeValue("ent-sco-cat-transportation", 2021, 11_000_00),
  makeValue("ent-sco-cat-transportation", 2024, 14_000_00),
  makeValue("ent-sco-cat-culture-and-leisure", 2022, 5_000_00),
  makeValue("ent-sco-cat-culture-and-leisure", 2023, 6_000_00),
  makeValue("ent-sco-cat-culture-and-leisure", 2024, 7_000_00),
];

const population: readonly PopulationObservation[] = [
  { fiscalYear: 2019, estimatedPopulation: 120000 },
  { fiscalYear: 2020, estimatedPopulation: 121000 },
  { fiscalYear: 2021, estimatedPopulation: 122000 },
  { fiscalYear: 2022, estimatedPopulation: 123000 },
  { fiscalYear: 2023, estimatedPopulation: 124000 },
  { fiscalYear: 2024, estimatedPopulation: 124320 },
];

const cpiAverages = fiscalYearAverage(parseCpiObservations(blsFixture));

describe("compareSeries", () => {
  it("produces one series per selected entity with points only for years that have data", () => {
    const result = compareSeries({
      values,
      entities,
      cpi: cpiAverages,
      population,
      entityIds: ["ent-sco-cat-public-safety", "ent-sco-cat-health"],
      yearRange: [2019, 2024],
      mode: "nominal",
      unit: "absolute",
      baseYear: 2024,
    });
    expect(result.series).toHaveLength(2);
    const ps = result.series.find((s) => s.entityId === "ent-sco-cat-public-safety");
    expect(ps?.points).toHaveLength(6);
    expect(ps?.points[0]?.fiscalYear).toBe(2019);
  });

  it("returns colorIndex in order 0,1,2,3 for the first four series", () => {
    const result = compareSeries({
      values,
      entities,
      cpi: cpiAverages,
      population,
      entityIds: [
        "ent-sco-cat-public-safety",
        "ent-sco-cat-health",
        "ent-sco-cat-transportation",
        "ent-sco-cat-culture-and-leisure",
      ],
      yearRange: [2019, 2024],
      mode: "nominal",
      unit: "absolute",
      baseYear: 2024,
    });
    expect(result.series.map((s) => s.colorIndex)).toEqual([0, 1, 2, 3]);
  });

  it("limits to MAX_COMPARE_ENTITIES even when more ids are passed", () => {
    const result = compareSeries({
      values,
      entities,
      cpi: cpiAverages,
      population,
      entityIds: [
        "ent-sco-cat-public-safety",
        "ent-sco-cat-health",
        "ent-sco-cat-transportation",
        "ent-sco-cat-culture-and-leisure",
        "ent-sco-cat-general-government",
      ],
      yearRange: [2019, 2024],
      mode: "nominal",
      unit: "absolute",
      baseYear: 2024,
    });
    expect(result.series.length).toBeLessThanOrEqual(MAX_COMPARE_ENTITIES);
  });

  it("applies CPI inflation in real mode so earlier years have larger amounts", () => {
    const result = compareSeries({
      values,
      entities,
      cpi: cpiAverages,
      population,
      entityIds: ["ent-sco-cat-public-safety"],
      yearRange: [2019, 2024],
      mode: "real",
      unit: "absolute",
      baseYear: 2024,
    });
    const ps = result.series[0];
    const fy2019 = ps?.points.find((p) => p.fiscalYear === 2019);
    const fy2024 = ps?.points.find((p) => p.fiscalYear === 2024);
    expect(fy2024?.amountCents).toBe(60_000_00);
    expect(fy2019?.amountCents).toBeGreaterThan(50_000_00);
  });

  it("does not inflate in nominal mode", () => {
    const result = compareSeries({
      values,
      entities,
      cpi: cpiAverages,
      population,
      entityIds: ["ent-sco-cat-public-safety"],
      yearRange: [2019, 2024],
      mode: "nominal",
      unit: "absolute",
      baseYear: 2024,
    });
    const fy2019 = result.series[0]?.points.find((p) => p.fiscalYear === 2019);
    expect(fy2019?.amountCents).toBe(50_000_00);
  });

  it("divides by population for per-resident unit", () => {
    const result = compareSeries({
      values,
      entities,
      cpi: cpiAverages,
      population,
      entityIds: ["ent-sco-cat-public-safety"],
      yearRange: [2024, 2024],
      mode: "nominal",
      unit: "per-resident",
      baseYear: 2024,
    });
    const fy2024 = result.series[0]?.points[0];
    expect(fy2024?.amountCents).toBe(Math.round(60_000_00 / 124320));
  });

  it("computes percent-change from the first year in the range", () => {
    const result = compareSeries({
      values,
      entities,
      cpi: cpiAverages,
      population,
      entityIds: ["ent-sco-cat-public-safety"],
      yearRange: [2019, 2024],
      mode: "nominal",
      unit: "percent-change",
      baseYear: 2024,
    });
    const fy2019 = result.series[0]?.points.find((p) => p.fiscalYear === 2019);
    const fy2024 = result.series[0]?.points.find((p) => p.fiscalYear === 2024);
    expect(fy2019?.amountCents).toBe(0);
    expect(fy2024?.amountCents).toBe(Math.round(((60_000_00 - 50_000_00) / 50_000_00) * 10000));
  });

  it("computes share-of-total using all expense-category values for that year", () => {
    const result = compareSeries({
      values,
      entities,
      cpi: cpiAverages,
      population,
      entityIds: ["ent-sco-cat-public-safety"],
      yearRange: [2024, 2024],
      mode: "nominal",
      unit: "share-of-total",
      baseYear: 2024,
    });
    const total2024 = values
      .filter((v) => v.fiscalYear === 2024)
      .reduce((sum, v) => sum + v.amountNominalCents, 0);
    const expected = Math.round((60_000_00 / total2024) * 10000);
    const fy2024 = result.series[0]?.points[0];
    expect(fy2024?.amountCents).toBe(expected);
  });

  it("marks entities with full range coverage as exact", () => {
    const result = compareSeries({
      values,
      entities,
      cpi: cpiAverages,
      population,
      entityIds: ["ent-sco-cat-public-safety"],
      yearRange: [2019, 2024],
      mode: "nominal",
      unit: "absolute",
      baseYear: 2024,
    });
    const ps = result.series[0];
    expect(ps?.points.every((p) => p.comparability === "exact")).toBe(true);
  });

  it("marks entities with partial range coverage as approximate", () => {
    const result = compareSeries({
      values,
      entities,
      cpi: cpiAverages,
      population,
      entityIds: ["ent-sco-cat-transportation"],
      yearRange: [2019, 2024],
      mode: "nominal",
      unit: "absolute",
      baseYear: 2024,
    });
    const trans = result.series[0];
    expect(trans?.points.every((p) => p.comparability === "approximate")).toBe(true);
  });

  it("only includes points for years where the entity has data", () => {
    const result = compareSeries({
      values,
      entities,
      cpi: cpiAverages,
      population,
      entityIds: ["ent-sco-cat-transportation"],
      yearRange: [2019, 2024],
      mode: "nominal",
      unit: "absolute",
      baseYear: 2024,
    });
    const trans = result.series[0];
    const years = trans?.points.map((p) => p.fiscalYear);
    expect(years).toEqual([2019, 2020, 2021, 2024]);
  });

  it("returns empty series when no entity ids are passed", () => {
    const result = compareSeries({
      values,
      entities,
      cpi: cpiAverages,
      population,
      entityIds: [],
      yearRange: [2019, 2024],
      mode: "nominal",
      unit: "absolute",
      baseYear: 2024,
    });
    expect(result.series).toEqual([]);
  });

  it("omits sourceLabel from each series when originalLabels is not set", () => {
    const result = compareSeries({
      values,
      entities,
      cpi: cpiAverages,
      population,
      entityIds: ["ent-sco-cat-public-safety"],
      yearRange: [2019, 2024],
      mode: "nominal",
      unit: "absolute",
      baseYear: 2024,
    });
    expect(result.series[0]?.sourceLabel).toBeUndefined();
  });

  it("includes sourceLabel on each series when originalLabels is true", () => {
    const result = compareSeries({
      values,
      entities,
      cpi: cpiAverages,
      population,
      entityIds: ["ent-sco-cat-public-safety"],
      yearRange: [2019, 2024],
      mode: "nominal",
      unit: "absolute",
      baseYear: 2024,
      originalLabels: true,
    });
    expect(typeof result.series[0]?.sourceLabel).toBe("string");
    expect(result.series[0]?.sourceLabel).toContain("public-safety");
  });
});
