// SYNTHETIC TEST FIXTURES — DO NOT LOAD IN PRODUCTION.
// Production reads `data/snapshots/src-sco-expenditures-per-capita-ykhf-vfsr/<releaseId>.json`
// and `data/snapshots/src-sco-revenues-per-capita-ky7j-fsk5/<releaseId>.json`,
// which are populated by `pnpm refresh:data`.
//
// Each synthetic row's `*_per_capita` value is set to the exact rounded
// `total_expenditures / estimated_population` (or `total_revenues /
// estimated_population`) result, so that `crossCheckInternal` (the 50-cent
// tolerance check) and `citywideTrend` agree within zero cents.

export interface ScoExpenditurePerCapitaFixtureRow {
  entity_name: string;
  fiscal_year: string;
  total_expenditures: string;
  estimated_population: string;
  expenditures_per_capita: string;
}

export interface ScoRevenuePerCapitaFixtureRow {
  entity_name: string;
  fiscal_year: string;
  total_revenues: string;
  estimated_population: string;
  revenues_per_capita: string;
}

export const scoExpenditurePerCapitaFixture: readonly ScoExpenditurePerCapitaFixtureRow[] = [
  {
    entity_name: "City of Berkeley",
    fiscal_year: "FY2024",
    total_expenditures: "780000000.00",
    estimated_population: "124320",
    expenditures_per_capita: "6274.13",
  },
  {
    entity_name: "City of Berkeley",
    fiscal_year: "FY2015",
    total_expenditures: "470000000.00",
    estimated_population: "118479",
    expenditures_per_capita: "3966.95",
  },
  {
    entity_name: "City of Berkeley",
    fiscal_year: "FY2003",
    total_expenditures: "300000000.00",
    estimated_population: "103500",
    expenditures_per_capita: "2898.55",
  },
];

export const scoRevenuePerCapitaFixture: readonly ScoRevenuePerCapitaFixtureRow[] = [
  {
    entity_name: "City of Berkeley",
    fiscal_year: "FY2024",
    total_revenues: "800000000.00",
    estimated_population: "124320",
    revenues_per_capita: "6435.01",
  },
  {
    entity_name: "City of Berkeley",
    fiscal_year: "FY2015",
    total_revenues: "490000000.00",
    estimated_population: "118479",
    revenues_per_capita: "4135.75",
  },
];
