// SYNTHETIC TEST FIXTURES — DO NOT LOAD IN PRODUCTION.
// Production reads `data/snapshots/src-bls-cpi-u-cuura422sa0/<releaseId>.json`,
// which is populated by `pnpm refresh:data`. These fixtures exist solely to
// exercise the BLS adapter's Zod schema, fiscal-year grouping, coverage-floor
// gating, and identity verification without contacting the live BLS API.
//
// BLS publishes the San Francisco-Oakland-Hayward CPI-U series bimonthly
// (six scheduled observations per Berkeley fiscal year: July, September,
// November, January, March, May). The fixtures therefore contain six rows
// per complete FY, not twelve monthly rows.

import type { BlsResponse } from "./bls-cpi";

function row(
  year: number,
  month: number,
  value: number,
): { year: string; period: string; value: string } {
  return {
    year: String(year),
    period: `M${String(month).padStart(2, "0")}`,
    value: value.toFixed(3),
  };
}

// Six bimonthly observations per Berkeley fiscal year, FY2019–FY2024.
// Each row is [calendarYear, calendarMonth, indexValue].
const fullRows = [
  // FY2019 (Jul 2018 – Jun 2019)
  [2018, 7, 271.012],
  [2018, 9, 272.108],
  [2018, 11, 273.45],
  [2019, 1, 274.812],
  [2019, 3, 276.105],
  [2019, 5, 277.43],
  // FY2020 (Jul 2019 – Jun 2020)
  [2019, 7, 280.123],
  [2019, 9, 281.412],
  [2019, 11, 282.51],
  [2020, 1, 283.602],
  [2020, 3, 283.945],
  [2020, 5, 282.789],
  // FY2021 (Jul 2020 – Jun 2021)
  [2020, 7, 284.31],
  [2020, 9, 285.45],
  [2020, 11, 286.53],
  [2021, 1, 287.801],
  [2021, 3, 289.12],
  [2021, 5, 291.012],
  // FY2022 (Jul 2021 – Jun 2022)
  [2021, 7, 292.87],
  [2021, 9, 294.103],
  [2021, 11, 296.001],
  [2022, 1, 298.412],
  [2022, 3, 300.812],
  [2022, 5, 303.511],
  // FY2023 (Jul 2022 – Jun 2023)
  [2022, 7, 306.301],
  [2022, 9, 308.432],
  [2022, 11, 310.42],
  [2023, 1, 312.123],
  [2023, 3, 313.901],
  [2023, 5, 315.812],
  // FY2024 (Jul 2023 – Jun 2024) — the initial base year
  [2023, 7, 317.012],
  [2023, 9, 318.901],
  [2023, 11, 320.012],
  [2024, 1, 321.512],
  [2024, 3, 323.012],
  [2024, 5, 324.89],
] as const;

export const blsFixture: BlsResponse = {
  Results: {
    seriesID: "CUURA422SA0",
    data: fullRows.map(([y, m, v]) => row(y, m, v)),
  },
};

// FY2024 is intentionally incomplete: only four of the six scheduled bimonthly
// observations (missing March and May 2024). This drops FY2024 below
// MIN_COVERAGE = 6 and exercises BlsCoverageIncompleteError / factorFor.
const partialRows = fullRows.filter(([y, m]) => !(y === 2024 && (m === 3 || m === 5)));
export const blsPartialFixture: BlsResponse = {
  Results: {
    seriesID: "CUURA422SA0",
    data: partialRows.map(([y, m, v]) => row(y, m, v)),
  },
};
