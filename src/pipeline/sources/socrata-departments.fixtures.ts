// SYNTHETIC TEST FIXTURES for the Socrata department rollup — DO NOT LOAD IN PRODUCTION.
// Production aggregates the verified snapshot at
// data/snapshots/src-berkeley-socrata-gy8t-iqc4/<releaseId>.json via build.ts.

import type { SocrataFixtureRow } from "./berkeley-socrata.fixtures";

// Expands a compact (department, fiscal_year, [amounts]) spec into individual
// raw fixture rows. Each amount is one adopted-budget line item in dollars.
function lineItems(
  department: string,
  fiscalYear: string,
  amounts: readonly number[],
  fund = "General Fund",
): readonly SocrataFixtureRow[] {
  const code = department
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase();
  return amounts.map((amount, index) => ({
    fiscal_year: fiscalYear,
    department,
    program: "Operations",
    expense_category: "Salaries",
    approved_amount: String(amount),
    fund,
    object_id: `${code}-${fiscalYear}-${index}`,
  }));
}

// Four departments (Police, Fire, Public Works, Parks) each clear the 10-row
// inclusion floor with two fiscal years. "Clerk Bureau" sits below the floor
// (4 total rows) and must be filtered out as noise.
export const socrataDepartmentsFixture: readonly SocrataFixtureRow[] = [
  ...lineItems("Police", "FY2013", [100000, 200000, 300000, 100000, 100000, 200000]),
  ...lineItems("Police", "FY2014", [110000, 220000, 330000, 110000, 110000, 220000]),
  ...lineItems("Fire", "FY2013", [80000, 80000, 80000, 80000, 80000, 80000]),
  ...lineItems("Fire", "FY2014", [90000, 90000, 90000, 90000, 90000, 90000]),
  ...lineItems("Public Works", "FY2013", [50000, 60000, 70000, 50000, 60000, 70000]),
  ...lineItems("Public Works", "FY2014", [55000, 66000, 77000, 55000, 66000, 77000]),
  ...lineItems("Parks", "FY2013", [30000, 40000, 30000, 40000, 30000, 40000]),
  ...lineItems("Parks", "FY2014", [35000, 45000, 35000, 45000, 35000, 45000]),
  // Below the 10-row inclusion floor — must be excluded from output.
  ...lineItems("Clerk Bureau", "FY2013", [10000, 20000]),
  ...lineItems("Clerk Bureau", "FY2014", [15000, 25000]),
];
