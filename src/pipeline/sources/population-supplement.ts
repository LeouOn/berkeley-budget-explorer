export interface PopulationSupplement {
  readonly fiscalYear: number;
  readonly estimatedPopulation: number;
  readonly sourceId: string;
  readonly sourceLabel: string;
}

// California Department of Finance (DOF), Demographic Research Unit, January
// 2025 population estimate for the City of Berkeley. The SCO per-capita
// datasets end at FY2024, so FY2025 per-capita values for ACFR and
// adopted-budget amounts rely on this single supplemental observation.
export const POPULATION_SUPPLEMENTS: readonly PopulationSupplement[] = [
  {
    fiscalYear: 2025,
    estimatedPopulation: 124_321,
    sourceId: "src-ca-dof-population-fy2025",
    sourceLabel: "CA Department of Finance January 2025 estimate for Berkeley",
  },
];

export function populationSupplementsFor(
  fiscalYears: readonly number[],
): readonly PopulationSupplement[] {
  const set = new Set(fiscalYears);
  return POPULATION_SUPPLEMENTS.filter((s) => set.has(s.fiscalYear));
}
