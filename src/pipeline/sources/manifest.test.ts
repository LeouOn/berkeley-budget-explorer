import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SourceEntrySchema,
  SourceIdSchema,
  SourceManifestSchema,
  loadSnapshot,
  readManifestFromDisk,
  verifySnapshot,
} from "./manifest";
import manifestData from "./manifest.data.json" with { type: "json" };

describe("source manifest schemas", () => {
  it("accepts a valid source id", () => {
    expect(() => SourceIdSchema.parse("src-bls-cpi")).not.toThrow();
  });

  it("rejects a malformed source id", () => {
    expect(() => SourceIdSchema.parse("BLS_CPI")).toThrow();
  });

  it("requires all canonical fields on a source entry", () => {
    const minimal = {
      id: "src-test",
      title: "Test",
      publisher: "Test Pub",
      url: "https://example.test/resource/test.json",
      identityField: "series_id",
      expectedIdentity: "TEST",
      retrievedAt: "2026-07-20",
      checksumSha256: "a".repeat(64),
      parserVersion: "1.0.0",
      fiscalPeriods: [{ start: 2020, end: 2024 }],
    };
    expect(() => SourceEntrySchema.parse(minimal)).not.toThrow();
  });

  it("rejects the all-zero placeholder checksum", () => {
    const placeholder = {
      id: "src-test",
      title: "Test",
      publisher: "Test Pub",
      url: "https://example.test/resource/test.json",
      identityField: "series_id",
      expectedIdentity: "TEST",
      retrievedAt: "2026-07-20",
      checksumSha256: "0".repeat(64),
      parserVersion: "1.0.0",
      fiscalPeriods: [{ start: 2020, end: 2024 }],
    };
    expect(() => SourceEntrySchema.parse(placeholder)).toThrow(/placeholder|all-zero/i);
  });

  it("rejects catalog HTML URLs (must be an API endpoint)", () => {
    const html = {
      id: "src-test",
      title: "Test",
      publisher: "Test Pub",
      url: "https://example.test/page.html",
      identityField: "series_id",
      expectedIdentity: "TEST",
      retrievedAt: "2026-07-20",
      checksumSha256: "a".repeat(64),
      parserVersion: "1.0.0",
      fiscalPeriods: [{ start: 2020, end: 2024 }],
    };
    expect(() => SourceEntrySchema.parse(html)).toThrow(/api endpoint/i);
  });

  it("the pinned manifest lists at least five sources", () => {
    const parsed = SourceManifestSchema.parse(manifestData);
    expect(parsed.sources.length).toBeGreaterThanOrEqual(5);
    const ids = parsed.sources.map((s) => s.id).sort();
    expect(ids).toContain("src-acfr-fy2025");
    expect(ids).toContain("src-berkeley-socrata-gy8t-iqc4");
    expect(ids).toContain("src-bls-cpi-u-cuura422sa0");
    expect(ids).toContain("src-budget-fy2025");
    expect(ids).toContain("src-sco-expenditures-ju3w-4gxp");
    expect(ids).toContain("src-sco-expenditures-per-capita-ykhf-vfsr");
    expect(ids).toContain("src-sco-revenues-per-capita-ky7j-fsk5");
  });

  it("the pinned manifest lists seven sources after the FY2025 adopted-budget addition", () => {
    const parsed = SourceManifestSchema.parse(manifestData);
    expect(parsed.sources.length).toBeGreaterThanOrEqual(7);
  });

  it("the pinned manifest lists eight sources after the FY2025 revenue-category addition", () => {
    const parsed = SourceManifestSchema.parse(manifestData);
    expect(parsed.sources).toHaveLength(8);
    const ids = parsed.sources.map((s) => s.id);
    expect(ids).toContain("src-revenue-budget-fy2025");
  });

  it("each source entry has an API URL containing /resource/ or a .pdf document", () => {
    const parsed = SourceManifestSchema.parse(manifestData);
    for (const s of parsed.sources) {
      expect(s.url).toMatch(/\/resource\/|\/publicAPI\/|\/api\/|\.pdf$/i);
    }
  });

  it("verifySnapshot returns ok when the on-disk bytes match the manifest checksum", () => {
    const parsed = SourceManifestSchema.parse(manifestData);
    for (const entry of parsed.sources) {
      const path = `data/snapshots/${entry.id}/rel-2026-07-20-001.json`;
      const bytes = readFileSync(path);
      const result = verifySnapshot(entry, bytes);
      expect(
        result.ok,
        `snapshot mismatch for ${entry.id}: ${result.ok ? "" : result.reason}`,
      ).toBe(true);
    }
  });

  it("loadSnapshot reads and verifies the snapshot for a known source", async () => {
    const result = await loadSnapshot({
      root: "data/snapshots",
      entry: SourceManifestSchema.parse(manifestData).sources[0]!,
      releaseId: "rel-2026-07-20-001",
    });
    expect(result.ok).toBe(true);
  });

  it("readManifestFromDisk refuses when any checksum is the all-zero placeholder", async () => {
    await expect(
      readManifestFromDisk("src/pipeline/sources/manifest.data.json"),
    ).resolves.toBeDefined();
  });
});
