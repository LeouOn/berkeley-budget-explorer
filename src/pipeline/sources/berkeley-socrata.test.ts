import { describe, expect, it } from "vitest";
import {
  assertCohortSealed,
  cohortFiscalYears,
  groupByService,
  parseSocrataRows,
} from "./berkeley-socrata";
import { socrataFixture } from "./berkeley-socrata.fixtures";

describe("berkeley-socrata adapter", () => {
  it("parses fixture rows and converts dollar strings to integer cents", () => {
    const rows = parseSocrataRows(socrataFixture);
    expect(rows[0]?.approvedAmountCents).toBe(1234567);
  });

  it("rejects a row outside the sealed FY2012–FY2015 cohort", () => {
    const rows = parseSocrataRows(socrataFixture);
    const outOfCohort = rows.map((r) => ({ ...r, fiscalYear: 2020 }));
    expect(() => assertCohortSealed(outOfCohort, 2012, 2015)).toThrow(/cohort/i);
  });

  it("reports the cohort's actual fiscal-year range", () => {
    const rows = parseSocrataRows(socrataFixture);
    expect(cohortFiscalYears(rows)).toEqual({ min: 2012, max: 2015 });
  });

  it("groups by service key derived from program/service/expense_category", () => {
    const rows = parseSocrataRows(socrataFixture);
    expect(groupByService(rows).length).toBeGreaterThan(0);
  });

  it("refuses malformed approved_amount values via parseDollarsToCents", () => {
    expect(() =>
      parseSocrataRows([
        {
          fiscal_year: "FY2014",
          department: "Public Works",
          approved_amount: "not-a-number",
          fund: "General Fund",
        },
      ]),
    ).toThrow(/malformed/i);
  });
});
