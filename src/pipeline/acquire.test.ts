import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acquireSource } from "./acquire";
import type { SourceEntry } from "./sources/manifest";

const baseEntry = {
  retrievedAt: "2026-07-20",
  checksumSha256: "a".repeat(64),
  parserVersion: "1.0.0",
  fiscalPeriods: [{ start: 1999, end: 2024 }],
};

const blsEntry: SourceEntry = {
  ...baseEntry,
  id: "src-bls-cpi-u-cuura422sa0",
  title: "BLS CPI-U",
  publisher: "BLS",
  url: "https://api.bls.gov/publicAPI/v2/timeseries/data/CUURA422SA0",
  identityField: "Results.seriesID",
  expectedIdentity: "CUURA422SA0",
};

const socrataEntry: SourceEntry = {
  ...baseEntry,
  id: "src-berkeley-socrata-gy8t-iqc4",
  title: "Berkeley Socrata Operating Budget",
  publisher: "City of Berkeley",
  url: "https://data.cityofberkeley.info/resource/gy8t-iqc4.json",
  identityField: "dataset_id",
  expectedIdentity: "gy8t-iqc4",
};

const scoDetailedEntry: SourceEntry = {
  ...baseEntry,
  id: "src-sco-expenditures-ju3w-4gxp",
  title: "SCO Detailed Expenditures",
  publisher: "California State Controller",
  url: "https://bythenumbers.sco.ca.gov/resource/ju3w-4gxp.json",
  identityField: "dataset_id",
  expectedIdentity: "ju3w-4gxp",
};

const scoExpPcEntry: SourceEntry = {
  ...baseEntry,
  id: "src-sco-expenditures-per-capita-ykhf-vfsr",
  title: "SCO Expenditures Per Capita",
  publisher: "California State Controller",
  url: "https://bythenumbers.sco.ca.gov/resource/ykhf-vfsr.json",
  identityField: "dataset_id",
  expectedIdentity: "ykhf-vfsr",
};

const scoRevPcEntry: SourceEntry = {
  ...baseEntry,
  id: "src-sco-revenues-per-capita-ky7j-fsk5",
  title: "SCO Revenues Per Capita",
  publisher: "California State Controller",
  url: "https://bythenumbers.sco.ca.gov/resource/ky7j-fsk5.json",
  identityField: "dataset_id",
  expectedIdentity: "ky7j-fsk5",
};

const goodBlsBody = JSON.stringify({ Results: { seriesID: "CUURA422SA0", data: [] } });
const badBlsBody = JSON.stringify({ Results: { seriesID: "WRONG", data: [] } });
const scoBerkeleyRow = {
  entity_name: "City of Berkeley",
  fiscal_year: "FY2024",
  value: "0",
  category: "x",
  subcategory_1: "y",
  subcategory_2: "z",
  line_description: "t",
  estimated_population: "0",
  type: "actual",
};
const scoEmptyArray: unknown[] = [];
const scoBerkeleyArray = [scoBerkeleyRow];

describe("acquireSource", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("BLS rejects a response whose body series id does not match the pinned series", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(badBlsBody, { status: 200 }),
    ) as unknown as typeof fetch;
    await expect(acquireSource(blsEntry)).rejects.toThrow(/seriesID|CUURA422SA0/);
  });

  it("BLS accepts a body whose seriesID matches the pinned series", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(goodBlsBody, { status: 200 }),
    ) as unknown as typeof fetch;
    const result = await acquireSource(blsEntry);
    expect(result.bytes.length).toBeGreaterThan(0);
    expect(result.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.checksumSha256).not.toBe("0".repeat(64));
  });

  it("Berkeley Socrata accepts the pinned dataset id in its manifest URL", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              fiscal_year: "FY2014",
              department: "Police",
              approved_amount: "0",
              fund: "General Fund",
            },
          ]),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    const result = await acquireSource(socrataEntry);
    expect(result.sourceId).toBe("src-berkeley-socrata-gy8t-iqc4");
  });

  it("SCO detailed expenditures reject an empty Berkeley body", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify(scoEmptyArray), { status: 200 }),
    ) as unknown as typeof fetch;
    await expect(acquireSource(scoDetailedEntry)).rejects.toThrow(/Berkeley|dataset/i);
  });

  it("SCO detailed expenditures accept a body that contains at least one City of Berkeley row", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify(scoBerkeleyArray), { status: 200 }),
    ) as unknown as typeof fetch;
    const result = await acquireSource(scoDetailedEntry);
    expect(result.sourceId).toBe("src-sco-expenditures-ju3w-4gxp");
  });

  it("SCO expenditures per capita reject a body without any Berkeley row", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              entity_name: "City of Oakland",
              fiscal_year: "FY2024",
              total_expenditures: "0",
              estimated_population: "0",
              expenditures_per_capita: "0",
            },
          ]),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    await expect(acquireSource(scoExpPcEntry)).rejects.toThrow(/Berkeley|dataset/i);
  });

  it("SCO revenues per capita accept a body with a Berkeley row", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              entity_name: "City of Berkeley",
              fiscal_year: "FY2024",
              total_revenues: "0",
              estimated_population: "0",
              revenues_per_capita: "0",
            },
          ]),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    const result = await acquireSource(scoRevPcEntry);
    expect(result.sourceId).toBe("src-sco-revenues-per-capita-ky7j-fsk5");
  });

  it("all five sources together can be acquired without identity failures when bodies match", async () => {
    globalThis.fetch = vi.fn(async (input: URL | Request | string) => {
      const url = String(input);
      if (url.includes("api.bls.gov")) return new Response(goodBlsBody, { status: 200 });
      if (url.includes("data.cityofberkeley.info")) {
        return new Response(
          JSON.stringify([
            {
              fiscal_year: "FY2014",
              department: "Police",
              approved_amount: "0",
              fund: "General Fund",
            },
          ]),
          { status: 200 },
        );
      }
      if (url.includes("ju3w-4gxp"))
        return new Response(JSON.stringify(scoBerkeleyArray), { status: 200 });
      if (url.includes("ykhf-vfsr")) {
        return new Response(
          JSON.stringify([
            {
              entity_name: "City of Berkeley",
              fiscal_year: "FY2024",
              total_expenditures: "0",
              estimated_population: "0",
              expenditures_per_capita: "0",
            },
          ]),
          { status: 200 },
        );
      }
      if (url.includes("ky7j-fsk5")) {
        return new Response(
          JSON.stringify([
            {
              entity_name: "City of Berkeley",
              fiscal_year: "FY2024",
              total_revenues: "0",
              estimated_population: "0",
              revenues_per_capita: "0",
            },
          ]),
          { status: 200 },
        );
      }
      return new Response("[]", { status: 200 });
    }) as unknown as typeof fetch;
    for (const entry of [blsEntry, socrataEntry, scoDetailedEntry, scoExpPcEntry, scoRevPcEntry]) {
      const result = await acquireSource(entry);
      expect(result.sourceId).toBe(entry.id);
    }
  });
});
