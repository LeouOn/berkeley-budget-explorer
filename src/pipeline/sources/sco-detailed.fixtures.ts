// SYNTHETIC TEST FIXTURES — DO NOT LOAD IN PRODUCTION.
// Production reads `data/snapshots/src-sco-expenditures-ju3w-4gxp/<releaseId>.json`,
// which is populated by `pnpm refresh:data`.

export interface ScoDetailedFixtureRow {
  entity_name: string;
  fiscal_year: string;
  value: string;
  category: string;
  subcategory_1: string;
  subcategory_2: string;
  line_description: string;
  estimated_population: string;
  type: string;
}

export const scoDetailedFixture: readonly ScoDetailedFixtureRow[] = [
  {
    entity_name: "City of Berkeley",
    fiscal_year: "FY2024",
    value: "125000.00",
    category: "Public Safety",
    subcategory_1: "Police",
    subcategory_2: "Patrol",
    line_description: "Police patrol salaries",
    estimated_population: "124320",
    type: "actual",
  },
  {
    entity_name: "City of Berkeley",
    fiscal_year: "FY2024",
    value: "8200.00",
    category: "Public Safety",
    subcategory_1: "Fire",
    subcategory_2: "Suppression",
    line_description: "Fire suppression overtime",
    estimated_population: "124320",
    type: "actual",
  },
  {
    entity_name: "City of Berkeley",
    fiscal_year: "FY2024",
    value: "780000000.00",
    category: "Public Safety",
    subcategory_1: "Subtotal",
    subcategory_2: "",
    line_description: "Subtotal: Public Safety",
    estimated_population: "124320",
    type: "actual",
  },
  {
    entity_name: "City of Oakland",
    fiscal_year: "FY2024",
    value: "950000000.00",
    category: "Public Safety",
    subcategory_1: "Patrol",
    subcategory_2: "",
    line_description: "Patrol salaries",
    estimated_population: "440000",
    type: "actual",
  },
];
