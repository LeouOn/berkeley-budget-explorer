import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeArtifact, writeArtifacts } from "./artifacts";
import type { OverviewSnapshot } from "./derive";

describe("artifacts writer", () => {
  it("writes a deterministic JSON file with sorted keys", () => {
    const dir = mkdtempSync(join(tmpdir(), "bbe-art-"));
    try {
      const payload = { z: 1, a: 2, nested: { y: 3, b: 4 } };
      writeArtifact(dir, "payload.json", payload);
      const text = readFileSync(join(dir, "payload.json"), "utf-8");
      expect(text).toContain('"a": 2');
      expect(text.indexOf('"a"')).toBeLessThan(text.indexOf('"nested"'));
      expect(text.indexOf('"nested"')).toBeLessThan(text.indexOf('"z"'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes the full artifact set used by the Overview route", () => {
    const dir = mkdtempSync(join(tmpdir(), "bbe-art-"));
    try {
      const overview: OverviewSnapshot = {
        fiscalYear: 2024,
        baseYear: 2024,
        mode: "real",
        surface: "sco-standardized-actuals",
        expendituresCents: 100,
        revenuesCents: 0,
        perResidentExpendituresCents: 1,
        perResidentRevenuesCents: 0,
        estimatedPopulation: 100,
        comparability: "reconstructed",
        sources: ["src-x"],
        notes: ["synthetic"],
      };
      writeArtifacts(dir, {
        release: {
          schemaVersion: "1.0.0",
          generatedAt: "2026-07-20T00:00:00.000Z",
          releaseId: "rel-1",
        },
        values: [],
        entities: [],
        cpi: {
          schemaVersion: "1.0.0",
          seriesId: "CUURA422SA0",
          baseYear: 2024,
          fiscalYearAverages: [],
        },
        population: { schemaVersion: "1.0.0", observations: [] },
        overview: {
          schemaVersion: "1.0.0",
          baseYear: 2024,
          surface: "sco-standardized-actuals",
          snapshots: [overview],
        },
        scoPerCapita: { schemaVersion: "1.0.0", expenditureTrendCents: [], revenueTrendCents: [] },
        scoDetailedContext: {
          schemaVersion: "1.0.0",
          surface: "category-context-only",
          schemaBreak: "test",
          sampleBerkeley: [],
        },
        socrataCohort: {
          schemaVersion: "1.0.0",
          cohortStart: 2012,
          cohortEnd: 2015,
          surface: "sealed-cohort-do-not-stitch",
          values: [],
        },
      });
      const expected = [
        "release.json",
        "values.json",
        "entities.json",
        "cpi.json",
        "population.json",
        "overview.json",
        "sco-per-capita.json",
        "sco-detailed-context.json",
        "socrata-cohort.json",
      ];
      for (const f of expected) {
        expect(existsSync(join(dir, f)), `missing artifact ${f}`).toBe(true);
        const text = readFileSync(join(dir, f), "utf-8");
        expect(text.length, `empty artifact ${f}`).toBeGreaterThan(2);
      }
      expect(readFileSync(join(dir, "release.json"), "utf-8")).toContain("rel-1");
      expect(readFileSync(join(dir, "values.json"), "utf-8")).toBe("[]\n");
      expect(readFileSync(join(dir, "overview.json"), "utf-8")).toContain('"fiscalYear": 2024');
      expect(readFileSync(join(dir, "socrata-cohort.json"), "utf-8")).toContain(
        "sealed-cohort-do-not-stitch",
      );
      expect(readFileSync(join(dir, "sco-detailed-context.json"), "utf-8")).toContain(
        "category-context-only",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
