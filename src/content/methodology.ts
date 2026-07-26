export interface MethodologySection {
  readonly title: string;
  readonly body: string;
}

export const methodologySections: readonly MethodologySection[] = [
  {
    title: "Sources",
    body: "Phase 1 ingests five structured sources, all recorded as checked-in API snapshots under data/snapshots/<source-id>/<release-id>.json: BLS CPI-U CUURA422SA0, Berkeley Open Data Socrata gy8t-iqc4 (FY2012-FY2015 adopted line items), California State Controller detailed expenditures ju3w-4gxp (category context only), California State Controller expenditures per capita ykhf-vfsr (authoritative citywide expenditures), and California State Controller revenues per capita ky7j-fsk5 (authoritative citywide revenues). Each release pins checksums, parser versions, and retrieval dates.",
  },
  {
    title: "Phase 1 surface",
    body: "The Overview page is a California State Controller standardized actual for the City of Berkeley, FY2003-FY2024. Adopted, revised, and projected values are not shown. Adopted-versus-actual variance is deferred to Phase 3, which adds reviewed Berkeley PDF and ACFR extraction.",
  },
  {
    title: "Inflation adjustment",
    body: "Inflation-adjusted amounts use BLS CPI-U CUURA422SA0 (San Francisco-Oakland-Hayward, all items), annualised as the arithmetic mean of bimonthly index values within each Berkeley fiscal year (July through June). BLS publishes this metropolitan series bimonthly, so each complete FY has six scheduled observations: July, September, November, January, March, May. The default base year is FY2024. Any fiscal year with fewer than six scheduled bimonthly observations is excluded from factor computation.",
  },
  {
    title: "Per-resident derivation",
    body: "Per-resident amounts use the California State Controller estimated_population value paired with the same fiscal year totals from the per-capita datasets ykhf-vfsr and ky7j-fsk5. The per-resident series ends at FY2024 and uses a single population source end-to-end.",
  },
  {
    title: "FY2025 population source",
    body: "The California State Controller per-capita datasets end at FY2024. For FY2025 per-capita calculations involving ACFR and adopted-budget amounts, the pipeline supplements the population series with the California Department of Finance January 2025 estimate for Berkeley (124,321 residents). This is a different source than the FY2003-FY2024 SCO estimated_population values and is disclosed here so cross-year comparisons involving FY2025 reflect the methodology break.",
  },
  {
    title: "Comparability",
    body: "Comparability levels are exact, reconstructed, approximate, or incompatible. Phase 1 does not compute adopted-versus-actual variances. Approximate mappings must never power a precise variance claim.",
  },
  {
    title: "Known schema breaks",
    body: "The Berkeley Socrata line-item cohort stops at FY2015 and is never stitched into the State Controller series. The State Controller detailed expenditure schema changes materially in FY2017; the Overview shows the citywide total across the break without implying line-item continuity. SCO detailed expenditures never sum into a citywide total because total/subtotal rows would double-count.",
  },
  {
    title: "PDF extraction",
    body: "PDF-derived adopted, revised, and actual values are deferred to a separate source-verification subplan. Phase 1 does not parse budget books or ACFRs. PDF rows marked review-required are excluded from public normalized comparisons.",
  },
  {
    title: "Release cadence",
    body: "The data pipeline runs at build time and is fully offline. pnpm refresh:data is the only network-capable command and is opt-in. pnpm build and pnpm build:artifacts read data/snapshots/ only, refuse to start when a snapshot is missing or when its SHA-256 does not match the manifest, and produce identical src/artifacts/*.json bytes when given identical snapshot bytes. The published site loads only the bundled artifacts and requires no source APIs at runtime.",
  },
];
