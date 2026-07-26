import { describe, expect, it } from "vitest";
import { POPULATION_SUPPLEMENTS, populationSupplementsFor } from "./population-supplement";

describe("population supplement", () => {
  it("exposes the CA DOF January 2025 estimate for Berkeley FY2025", () => {
    expect(POPULATION_SUPPLEMENTS).toHaveLength(1);
    const [supp] = POPULATION_SUPPLEMENTS;
    expect(supp?.fiscalYear).toBe(2025);
    expect(supp?.estimatedPopulation).toBe(124_321);
    expect(supp?.sourceId).toBe("src-ca-dof-population-fy2025");
    expect(supp?.sourceLabel.length).toBeGreaterThan(0);
  });

  it("populationSupplementsFor returns matching supplements for requested years", () => {
    const matches = populationSupplementsFor([2024, 2025, 2026]);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.fiscalYear).toBe(2025);
  });

  it("populationSupplementsFor returns nothing when FY2025 is absent", () => {
    expect(populationSupplementsFor([2020, 2024])).toEqual([]);
  });
});
