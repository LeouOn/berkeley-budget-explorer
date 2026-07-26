// SYNTHETIC TEST FIXTURES — DO NOT LOAD IN PRODUCTION.
// Production reads `data/snapshots/src-berkeley-socrata-gy8t-iqc4/<releaseId>.json`,
// which is populated by `pnpm refresh:data` from the pinned Socrata endpoint.

export interface SocrataFixtureRow {
  fiscal_year: string;
  department: string;
  program?: string;
  service?: string;
  expense_category?: string;
  approved_amount: string;
  fund: string;
  description?: string;
  expense_type?: string;
  object_id?: string;
}

export const socrataFixture: readonly SocrataFixtureRow[] = [
  {
    fiscal_year: "FY2012",
    department: "Fire",
    program: "Suppression",
    expense_category: "Salaries",
    approved_amount: "12345.67",
    fund: "General Fund",
    object_id: "FIRE-010",
  },
  {
    fiscal_year: "FY2014",
    department: "Public Works",
    program: "Streets and Sidewalks",
    expense_category: "Salaries",
    approved_amount: "12345.67",
    fund: "General Fund",
    object_id: "PW-001",
  },
  {
    fiscal_year: "FY2014",
    department: "Public Works",
    program: "Streets and Sidewalks",
    expense_category: "Materials",
    approved_amount: "7890.0",
    fund: "General Fund",
    object_id: "PW-002",
  },
  {
    fiscal_year: "FY2014",
    department: "Police",
    program: "Patrol",
    expense_category: "Salaries",
    approved_amount: "50000.0",
    fund: "General Fund",
    object_id: "POL-100",
  },
  {
    fiscal_year: "FY2015",
    department: "Public Works",
    program: "Streets and Sidewalks",
    expense_category: "Salaries",
    approved_amount: "13000.0",
    fund: "General Fund",
    object_id: "PW-001",
  },
  {
    fiscal_year: "FY2015",
    department: "Library",
    program: "Public Services",
    expense_category: "Materials",
    approved_amount: "4500.0",
    fund: "Library Tax Fund",
    object_id: "LIB-200",
  },
];
