import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ReconciliationResult } from "../reconcile/reconcile";
import { writeQualityReport } from "./quality-report";

describe("quality report", () => {
  it("writes a JSON file describing sources, reconciliation status, and stage counts", () => {
    const dir = mkdtempSync(join(tmpdir(), "bbe-qr-"));
    try {
      const ok: ReconciliationResult = { ok: true };
      const fail: ReconciliationResult = {
        ok: false,
        mismatches: [
          {
            fiscalYear: 2024,
            computedCents: 100,
            controlCents: 99,
            diffCents: 1,
            sourceId: "src-x",
          },
        ],
      };
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
        normalizationCounts: { adopted: 0, actual: 6, projected: 0, revised: 0, proposed: 0 },
        reconciliation: [
          { sourceId: "src-socrata", result: ok },
          { sourceId: "src-ca", result: fail },
        ],
        comparabilityNotes: [
          "Socrata cohort stops at FY2015; do not stitch into State Controller series.",
          "SCO detailed expenditure schema changes in FY2017; citywide totals remain comparable.",
        ],
      });
      const text = readFileSync(join(dir, "quality-report.json"), "utf-8");
      expect(text).toContain('"releaseId": "rel-1"');
      expect(text).toContain('"status": "failed"');
      expect(text).toContain("Socrata cohort stops at FY2015");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
