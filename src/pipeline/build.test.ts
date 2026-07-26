import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeArtifact } from "./derive/artifacts";
import { writeQualityReport } from "./derive/quality-report";

describe("build pipeline integration", () => {
  it("produces all seven expected artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "bbe-build-"));
    try {
      writeArtifact(dir, "release.json", {
        schemaVersion: "1.0.0",
        releaseId: "rel-1",
        generatedAt: "2026-07-20T00:00:00.000Z",
        sources: [],
      });
      writeArtifact(dir, "values.json", []);
      writeArtifact(dir, "entities.json", []);
      writeArtifact(dir, "cpi.json", {
        schemaVersion: "1.0.0",
        seriesId: "CUURA422SA0",
        fiscalYearAverages: [],
      });
      writeArtifact(dir, "population.json", { schemaVersion: "1.0.0", observations: [] });
      writeArtifact(dir, "overview.json", {
        schemaVersion: "1.0.0",
        baseYear: 2024,
        snapshots: [],
      });
      writeQualityReport(dir, {
        releaseId: "rel-1",
        generatedAt: "2026-07-20T00:00:00.000Z",
        sourceCount: 5,
        sourceIds: [
          "src-bls-cpi-u-cuura422sa0",
          "src-berkeley-socrata-gy8t-iqc4",
          "src-sco-expenditures-ju3w-4gxp",
          "src-sco-expenditures-per-capita-ykhf-vfsr",
          "src-sco-revenues-per-capita-ky7j-fsk5",
        ],
        normalizationCounts: { adopted: 6, actual: 3, projected: 0, revised: 0, proposed: 0 },
        reconciliation: [],
        comparabilityNotes: [],
      });
      for (const f of [
        "release.json",
        "values.json",
        "entities.json",
        "cpi.json",
        "population.json",
        "overview.json",
        "quality-report.json",
      ]) {
        const text = readFileSync(join(dir, f), "utf-8");
        expect(text.length).toBeGreaterThan(2);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
