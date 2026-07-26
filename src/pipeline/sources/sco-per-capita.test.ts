import { describe, expect, it } from "vitest";
import {
  citywideTrend,
  crossCheckInternal,
  filterBerkeley,
  parseScoExpenditurePerCapita,
  parseScoRevenuePerCapita,
} from "./sco-per-capita";
import {
  scoExpenditurePerCapitaFixture,
  scoRevenuePerCapitaFixture,
} from "./sco-per-capita.fixtures";

describe("sco-per-capita adapters", () => {
  it("parses expenditure per-capita rows with text fiscal_year/value/population", () => {
    const rows = parseScoExpenditurePerCapita(scoExpenditurePerCapitaFixture);
    expect(rows[0]?.fiscalYear).toBe(2024);
    expect(rows[0]?.totalExpendituresCents).toBe(78000000000);
    expect(rows[0]?.estimatedPopulation).toBe(124320);
  });

  it("parses revenue per-capita rows with the analogous schema", () => {
    const rows = parseScoRevenuePerCapita(scoRevenuePerCapitaFixture);
    expect(rows[0]?.totalRevenuesCents).toBe(80000000000);
  });

  it("filterBerkeley restricts to the City of Berkeley", () => {
    const rows = parseScoExpenditurePerCapita(scoExpenditurePerCapitaFixture);
    expect(filterBerkeley(rows).every((r) => r.entityName === "City of Berkeley")).toBe(true);
  });

  it("crossCheckInternal passes when total/pop ≈ per_capita (within $0.50)", () => {
    const rows = parseScoExpenditurePerCapita(scoExpenditurePerCapitaFixture);
    expect(() => crossCheckInternal(rows)).not.toThrow();
  });

  it("crossCheckInternal rejects a row whose per-capita value disagrees by >$0.50", () => {
    const rows = parseScoExpenditurePerCapita([
      ...scoExpenditurePerCapitaFixture,
      {
        entity_name: "City of Berkeley",
        fiscal_year: "FY2023",
        total_expenditures: "600000000.00",
        estimated_population: "121000",
        expenditures_per_capita: "9999.99",
      },
    ]);
    expect(() => crossCheckInternal(rows)).toThrow(/cross-check/i);
  });

  it("citywideTrend produces a year-keyed FY2003–FY2024 series", () => {
    const exp = parseScoExpenditurePerCapita(scoExpenditurePerCapitaFixture);
    const rev = parseScoRevenuePerCapita(scoRevenuePerCapitaFixture);
    const trend = citywideTrend(filterBerkeley(exp), filterBerkeley(rev));
    const fy2024 = trend.find((t) => t.fiscalYear === 2024);
    expect(fy2024?.expendituresCents).toBe(78000000000);
    // The fixture sets expenditures_per_capita to the exact rounded
    // total/population result ($6274.13 = 627413 cents). Both the
    // source-published per-capita value and the derived value agree.
    expect(fy2024?.perResidentExpendituresCents).toBe(627413);
    expect(fy2024?.perResidentExpendituresCents).toBe(Math.round(78000000000 / 124320));
  });
});
