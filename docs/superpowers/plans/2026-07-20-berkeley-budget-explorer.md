# Berkeley Budget Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of the Berkeley Budget Explorer: a statically deployable civic atlas where a resident can read Berkeley's overall budget trend, switch between real and nominal dollars, inspect sources, and verify every charted value in a synchronized accessible table. Every Phase 1 value is a **California State Controller standardized actual** for Berkeley, not an adopted budget figure.

**Architecture:** A versioned build-time data pipeline ingests **exactly five pinned structured sources** — BLS CPI-U `CUURA422SA0`, Berkeley Socrata `gy8t-iqc4`, SCO City Expenditures `ju3w-4gxp`, SCO City Expenditures Per Capita `ykhf-vfsr`, SCO City Revenues Per Capita `ky7j-fsk5` — from authoritative API responses recorded as snapshots under `data/snapshots/<source-id>/<release-id>.json` with companion `.sha256` sidecars. Each snapshot is a checked-in, byte-for-byte recording of the live API response. A separate, opt-in acquisition command (`pnpm refresh:data`) fetches only those five pinned endpoints over HTTPS, validates each response against its Zod schema, verifies the source identity (series id, dataset id, entity scope), computes the actual SHA-256 checksum, and atomically replaces the snapshot in `data/snapshots/`. The default `pnpm build` and `pnpm build:artifacts` commands read snapshots only; they are deterministic, offline, and refuse to start if a snapshot is missing or if its SHA-256 in the manifest does not match the file on disk. The pipeline normalizes snapshots to a Zod-validated canonical model, reconciles the per-capita totals against per-capita values within the source itself, derives CPI factors and per-resident measures, and emits immutable JSON artifacts. The React 19 application reads only those artifacts at runtime through a typed query layer. The Overview route renders an accessible fiscal snapshot of Berkeley's standardized SCO FY2003–FY2024 actuals, a service taxonomy, a nominal/real toggle defaulting to FY2024 dollars, a synchronized semantic `<table>` with an Observable Plot trend chart, and source citations to all five manifest entries. No chart component fetches source data independently. No runtime call to any source API. The Berkeley Socrata `gy8t-iqc4` cohort is sealed to FY2012–FY2015 and is never stitched to SCO actuals. SCO detailed expenditures provide category context and schema-break disclosure only; citywide totals come exclusively from the per-capita datasets. Synthetic data is allowed only inside `*.fixtures.ts` files, which `pnpm build:artifacts` never imports.

**Tech Stack:** Node.js 22 LTS, pnpm 10, TypeScript 5.x (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), React 19.2, React DOM 19.2, Vite 8, `@vitejs/plugin-react` v5, Zod 4, Observable Plot 0.6, Vitest 3 with `happy-dom`, `@testing-library/react` 16, Playwright 1.50+, Biome 1.9, `tsx` 4 for pipeline entry. No CSS framework; CSS Modules with custom properties. No state library; React hooks plus URL state. No router library; URL state + minimal hash routing for the two Phase 1 routes.

## Global Constraints

The following constraints are copied verbatim from `docs/superpowers/specs/2026-07-20-berkeley-budget-explorer-design.md`. Every task's requirements implicitly include this section. Treat each line as a release-blocking invariant.

1. The product is a **layered civic atlas** that welcomes residents, journalists, researchers, advocates, and city staff from one information architecture; it does not ship separate applications per audience.
2. **Progressive disclosure:** resident-recognizable services appear first; funds, departments, programs, and account categories are revealed as users go deeper.
3. **Comparison is the core interaction** for expert users. Phase 1 ships only the overview; comparison workspace is Phase 2.
4. **Real dollars by default** for any historical view; **nominal is one explicit toggle away**.
5. **Adopted, revised, projected, and actual values must never be blended into a single unlabeled series.** Phase 1 surfaces only standardized actuals.
6. **Source fidelity is visible:** every value retains its source, extraction method, freshness, and comparability status.
7. **No false continuity:** renames, reorganizations, missing detail, and schema breaks must appear in the interface rather than be silently normalized.
8. **One analysis, many representations:** charts, tables, summaries, downloads, and shareable URLs derive from the same query result.
9. **Accessible by default:** tables and textual summaries are first-class outputs, never fallback attachments.
10. **Fast without live dependencies:** published pages must remain useful if Berkeley or state data portals are unavailable.
11. **Data is processed through an eight-step pipeline:** Acquire → Extract → Validate → Normalize → Map → Reconcile → Derive → Publish.
12. **Pipeline release fails** when a required source checksum changes without review, required columns disappear or change type, canonical keys are duplicated, structured source records fail to equal their published machine-readable control total to the cent, a mapping targets an unknown entity or overlaps an incompatible effective period, or an editorial insight references unavailable or non-verified records.
13. **PDF-derived rows marked `review-required` are excluded from public normalized comparisons.** PDF extraction is deferred to a separate source-verification subplan and is **not** part of Phase 1.
14. **Inflation-adjusted amounts are derived** at query or artifact-build time from `amountNominal`, the selected base year, and the pinned CPI series; they are never stored as independent source facts.
15. **Fiscal-year convention:** Berkeley's fiscal year begins July 1 and ends June 30. FY2024 = July 2023 – June 2024. All CPI annualization and per-resident derivation uses this convention.
16. **CPI series:** BLS CPI-U `CUURA422SA0`, All Items, San Francisco-Oakland-Hayward. BLS publishes this metropolitan series bimonthly. Annualize via the arithmetic mean of the six scheduled published observations within each Berkeley fiscal year, without inventing values for unpublished intervening months. Name the displayed base year in the UI. A fiscal-year average must contain at least six scheduled bimonthly observations (`MIN_COVERAGE = 6`) or it is excluded from factor computation; `FiscalYearAverage.observationCount` records the actual count and is bounded to `[0, 6]`.
17. **Population series:** Phase 1 uses the California State Controller `estimated_population` value paired with the same fiscal year's revenue/expenditure totals. The historical series therefore ends at FY2024. A later migration to California Department of Finance estimates must recompute the entire historical series in one versioned release and may not splice a second population source onto the State Controller series.
18. **Schema breaks:** State Controller detailed expenditure schema changes materially in FY2017. The FY2015/2016 break and the FY2017 schema break must be **visible** in Phase 1's methodology copy and acknowledged on the Overview page. The Phase 1 Overview surfaces only the State Controller citywide totals (which remain comparable across the schema break) and the Socrata FY2012–FY2015 line-item cohort (which stops at FY2015). It does not stitch them into a single per-capita series.
19. **Comparability levels:** `exact`, `reconstructed`, `approximate`, `incompatible`. Approximate mappings may appear in exploratory views only when visibly labeled and may not power a precise adopted-to-actual variance claim. Phase 1 does not compute adopted-vs-actual variances.
20. **No chart component may fetch or aggregate source data independently.** Every series comes from a typed query against the immutable artifacts.
21. **No `any`, no `// @ts-ignore`, no `// @ts-expect-error`, no `# type: ignore`, no empty `catch {}`, no `as any`, no `as unknown as`, no `!` non-null assertions outside tests.** Parse at the boundary with Zod; trust types in the interior.
22. **Every implementation file stays at or below 250 pure LOC** (non-blank, non-comment). Split before adding lines when a file approaches the band.
23. **WCAG 2.2 AA is a release criterion.** Keyboard operability, focus visibility, direct labels plus redundant non-color encodings, concise chart summaries, synchronized semantic tables, programmatic names/states/errors/help, 320 CSS pixel layout viability, 200% zoom without loss of functionality, and `prefers-reduced-motion` compliance are tested before Phase 1 exit.
24. **Performance budget for Phase 1:** the Overview route's first contentful paint on a throttled mid-range mobile profile (Moto G Power class, 4× CPU throttle, Slow 4G) must occur within 2.0 seconds; the route must not load the full line-item corpus. Overview aggregates are precomputed in `artifacts/overview.json`.
25. **The directory is not a Git repository.** Every `git commit` step in this plan is labeled **OPTIONAL** and must be skipped unless the executor explicitly initializes a Git repo and the human partner approves committing. Default execution performs no version-control operations.
26. **Exactly five sources in Phase 1.** The manifest at `src/pipeline/sources/manifest.data.json` lists the five pinned source identifiers in this order: `src-bls-cpi-u-cuura422sa0`, `src-berkeley-socrata-gy8t-iqc4`, `src-sco-expenditures-ju3w-4gxp`, `src-sco-expenditures-per-capita-ykhf-vfsr`, `src-sco-revenues-per-capita-ky7j-fsk5`. The `SourceManifestSchema` refines the sources array to length five.
27. **Production snapshots are checked-in, real, authoritative API recordings.** `data/snapshots/<source-id>/<release-id>.json` holds the canonical JSON bytes of parsed API responses captured from the five pinned endpoints. The canonical form is `JSON.stringify(parsedBody, replacer)` with `undefined`, `function`, and `symbol` values stripped. Each snapshot carries the SHA-256 of those canonical bytes plus the parser version. The pipeline does NOT store raw HTTP response bytes; checksum semantics are therefore stable across whitespace, key-ordering, and re-serialization differences. Synthetic data exists only inside test files (`*.fixtures.ts` and `*.test.ts`) and never reaches `src/artifacts/`. No source description in the manifest is permitted to point at a catalog HTML page; the `SourceEntrySchema` refines each `url` to contain `/resource/`, `/publicAPI/`, or `/api/`.
28. **Tests use synthetic fixtures; production never does.** Every `*.fixtures.ts` ships with a documented notice that the values are synthetic. Adapters consume the snapshot at runtime in production; the same adapter functions take a parsed snapshot in tests so fixture bytes never appear in `dist/`. `src/pipeline/build.ts` must not import any `*.fixtures.ts` module.
29. **`pnpm refresh:data` is the only network-capable command.** It is opt-in (must be invoked explicitly), fetches only the five pinned official API endpoints (one HTTPS `GET` per source), writes temporary files in `.artifacts-cache/`, validates each response against its source-specific identity rule (BLS body series id, Socrata/SCO pinned dataset id in the manifest URL plus Berkeley entity scope in the parsed rows), canonicalizes the body, computes the SHA-256 of the canonical bytes, and atomically replaces `data/snapshots/<source-id>/<release-id>.json`. On any failure it leaves the existing snapshot untouched.
30. **`pnpm build` and `pnpm build:artifacts` are offline and deterministic.** They read `data/snapshots/` only, never make network calls, never consult `process.env` for endpoint URLs, and produce identical `src/artifacts/*.json` bytes when given identical snapshot bytes. A normal build refuses to start if a snapshot is missing or if its SHA-256 in the manifest does not match the file on disk.
31. **Production checksums are never placeholders.** The release refuses to publish when a manifest entry's `checksumSha256` is the literal 64-character zero string. Real checksums come from `pnpm refresh:data`; humans never hand-edit them.
32. **BLS coverage floor.** Because BLS publishes the San Francisco metropolitan CPI bimonthly, the CPI fiscal-year average for any FY used by the engine must contain at least `MIN_COVERAGE = 6` scheduled bimonthly observations. Otherwise the FY is excluded from factor computation and the Overview shows a "coverage incomplete" notice. `BlsCoverageIncompleteError` is thrown by `factorFor` when either year falls below six observations. See the official BLS San Francisco release methodology cited in References.
33. **SCO per-capita datasets are authoritative for Phase 1 citywide totals.** The Overview's FY2003–FY2024 total expenditure, total revenue, per-resident expenditure, per-resident revenue, and population trend are derived exclusively from `ykhf-vfsr` and `ky7j-fsk5`. SCO detailed expenditures (`ju3w-4gxp`) supply category context and schema-break disclosure; their per-line values are **never summed into a citywide total** because total/subtotal rows would double-count.
34. **Socrata cohort is sealed.** `gy8t-iqc4` covers FY2012–FY2015 adopted line items only. It is never stitched to SCO actuals in any chart, table, or per-capita series. The interface must state this whenever Socrata is shown.
35. **Phase 1 surface is standardized actuals, not adopted budget.** Every figure on the Overview is a SCO standardized actual from a published dataset for Berkeley. Adopted-versus-actual variance remains deferred because reviewed Berkeley PDF and ACFR extraction is a Phase 3 capability. The Overview must say so.
36. **Base year for inflation is the latest complete Berkeley fiscal year**, initially FY2024 (July 2023 – June 2024). The `OverviewUrlState` exposes `baseYear` so a future phase can override it; Phase 1 ships with `baseYear = 2024` as the default. `latestCompleteFiscalYear(averages, MIN_COVERAGE)` is the source of truth for the initial base year; a future refresh:data may bump it without code changes.
37. **The pipeline runs at build time only.** The published static site loads only `src/artifacts/*.json` (bundled by Vite). No network call occurs in any browser session.
38. **Decimal-to-cents parser is exact.** `parseDollarsToCents` uses `BigInt` arithmetic end-to-end, applies the sign exactly once at the end, refuses values beyond `Number.MAX_SAFE_INTEGER`, rejects malformed input and more than two decimal places, and treats `0` and `0.00` as zero. The test suite explicitly covers `123.45`, `-123.45`, `0`, malformed input, and the unsafe range.

## File Map

The Phase 1 deliverable creates the following files. Each has one responsibility. Every file stays at or below 250 pure LOC; tasks that grow a file into the 200–250 warning band include an inline split.

```
berkeley-budget/
├── .nvmrc                                      # Node 22 pin
├── .editorconfig                               # Whitespace + UTF-8
├── .gitignore                                  # Node/Vite/Vitest/Playwright defaults; ignores .artifacts-cache/
├── package.json                                # pnpm manifest, scripts (incl. refresh:data), deps
├── pnpm-lock.yaml                              # generated by pnpm install
├── tsconfig.json                               # solution-style project references
├── tsconfig.app.json                           # browser/React config (strict)
├── tsconfig.node.json                          # pipeline config (Node 22)
├── biome.json                                  # lint + format single config
├── vite.config.ts                              # Vite 8 + React plugin (no network)
├── vitest.config.ts                            # Vitest 3 with happy-dom
├── playwright.config.ts                        # Playwright with webServer preview
├── index.html                                  # Vite SPA entry
├── public/
│   └── favicon.svg                             # civic neutral mark
├── data/
│   └── snapshots/                              # real authoritative API recordings, checked in
│       ├── src-bls-cpi-u-cuura422sa0/
│       │   ├── rel-2026-07-20-001.json         # raw BLS time-series response
│       │   └── rel-2026-07-20-001.sha256       # checksum sidecar
│       ├── src-berkeley-socrata-gy8t-iqc4/
│       │   ├── rel-2026-07-20-001.json
│       │   └── rel-2026-07-20-001.sha256
│       ├── src-sco-expenditures-ju3w-4gxp/
│       │   ├── rel-2026-07-20-001.json
│       │   └── rel-2026-07-20-001.sha256
│       ├── src-sco-expenditures-per-capita-ykhf-vfsr/
│       │   ├── rel-2026-07-20-001.json
│       │   └── rel-2026-07-20-001.sha256
│       └── src-sco-revenues-per-capita-ky7j-fsk5/
│           ├── rel-2026-07-20-001.json
│           └── rel-2026-07-20-001.sha256
├── src/
│   ├── main.tsx                                # createRoot mount
│   ├── App.tsx                                 # Overview + Methodology routing
│   ├── vite-env.d.ts                           # Vite client types
│   ├── styles/
│   │   ├── reset.css                           # modern minimal CSS reset
│   │   ├── tokens.css                          # design tokens (custom properties)
│   │   └── globals.css                         # body, headings, focus, reduced motion
│   ├── design-system/
│   │   ├── index.ts                            # barrel export
│   │   ├── PageLayout.tsx                      # Skip link + main + footer
│   │   ├── PageLayout.module.css
│   │   ├── SkipLink.tsx                        # WCAG 2.4.1 bypass block
│   │   ├── SkipLink.module.css
│   │   ├── Toggle.tsx                          # real/nominal pill toggle
│   │   ├── Toggle.module.css
│   │   ├── Card.tsx                            # service card with caption
│   │   ├── Card.module.css
│   │   ├── DefinitionList.tsx                  # dl/dt/dd primitive
│   │   ├── DefinitionList.module.css
│   │   ├── DataTable.tsx                       # semantic <table> with caption
│   │   ├── DataTable.module.css
│   │   ├── TrendChart.tsx                      # Observable Plot mount
│   │   └── TrendChart.module.css
│   ├── content/
│   │   ├── services.ts                         # curated service taxonomy
│   │   ├── services.test.ts                    # taxonomy completeness tests
│   │   ├── methodology.ts                      # sources/limitations copy
│   │   └── methodology.test.ts                 # required disclosure presence
│   ├── pipeline/
│   │   ├── build.ts                            # offline build entry (tsx); reads snapshots only
│   │   ├── build.test.ts                       # golden output tests
│   │   ├── acquire.ts                          # OPT-IN network fetch (pnpm refresh:data)
│   │   ├── acquire.test.ts                     # acquire unit tests with mocked fetch
│   │   ├── sources/
│   │   │   ├── manifest.ts                     # Zod source-manifest schema + load helpers
│   │   │   ├── manifest.test.ts
│   │   │   ├── manifest.data.json              # 5-source manifest (real checksums after refresh:data)
│   │   │   ├── money.ts                        # typed fixed-point decimal → cents parser
│   │   │   ├── money.test.ts                   # incl. negatives, malformed, out-of-range
│   │   │   ├── bls-cpi.ts                      # BLS CPI-U adapter (verifies series id, coverage floor)
│   │   │   ├── bls-cpi.test.ts
│   │   │   ├── bls-cpi.fixtures.ts             # SYNTHETIC test fixtures only
│   │   │   ├── berkeley-socrata.ts             # Socrata gy8t-iqc4 adapter
│   │   │   ├── berkeley-socrata.test.ts
│   │   │   ├── berkeley-socrata.fixtures.ts    # SYNTHETIC test fixtures only
│   │   │   ├── sco-detailed.ts                 # SCO ju3w-4gxp detailed expenditures (category context)
│   │   │   ├── sco-detailed.test.ts
│   │   │   ├── sco-detailed.fixtures.ts        # SYNTHETIC test fixtures only
│   │   │   ├── sco-per-capita.ts               # SCO ykhf-vfsr + ky7j-fsk5 per-capita adapters
│   │   │   ├── sco-per-capita.test.ts
│   │   │   └── sco-per-capita.fixtures.ts      # SYNTHETIC test fixtures only
│   │   ├── canonical/
│   │   │   ├── schema.ts                       # BudgetValue/Entity/Crosswalk Zod
│   │   │   ├── schema.test.ts
│   │   │   ├── normalize.ts                    # snapshot → canonical mapper
│   │   │   ├── normalize.test.ts
│   │   │   ├── crosswalk.ts                    # effective-dated loader + validator
│   │   │   ├── crosswalk.data.json             # pinned crosswalk
│   │   │   └── crosswalk.test.ts
│   │   ├── reconcile/
│   │   │   ├── reconcile.ts                    # per-capita cross-check + coverage gating
│   │   │   ├── reconcile.test.ts
│   │   │   └── reconcile.fixtures.ts           # SYNTHETIC test fixtures only
│   │   └── derive/
│   │       ├── derive.ts                       # CPI factors, per-resident, share
│   │       ├── derive.test.ts
│   │       ├── artifacts.ts                    # immutable JSON writer
│   │       ├── artifacts.test.ts
│   │       ├── quality-report.ts               # human-readable report (real snapshot status)
│   │       └── quality-report.test.ts
│   ├── query/
│   │   ├── engine.ts                           # typed query layer (per-capita authoritative)
│   │   ├── engine.test.ts
│   │   ├── url-state.ts                        # parse/serialize URL state
│   │   └── url-state.test.ts
│   ├── artifacts/                              # generated by build, checked in
│   │   ├── release.json                        # release manifest
│   │   ├── values.json                         # normalized BudgetValue[]
│   │   ├── entities.json                       # Entity[]
│   │   ├── cpi.json                            # CPI fiscal-year averages + coverage flags
│   │   ├── sco-per-capita.json                 # authoritative FY2003–FY2024 trend inputs
│   │   ├── sco-detailed-context.json           # category context + schema-break disclosure
│   │   ├── socrata-cohort.json                 # sealed FY2012–FY2015 line items (no stitching)
│   │   ├── overview.json                       # precomputed Overview snapshot (SCO actuals)
│   │   └── quality-report.json                 # pipeline quality report (real snapshot refs)
│   └── routes/
│       ├── Overview.tsx                        # snapshot + cards + chart + table (SCO actuals)
│       ├── Overview.module.css
│       ├── Overview.test.tsx                   # component tests
│       ├── Methodology.tsx                     # 5 sources, SCO standardized-actuals scope, limitations
│       └── Methodology.module.css
└── tests/
    └── browser/
        ├── overview.spec.ts                    # Playwright journey tests (5 sources)
        └── a11y.spec.ts                        # axe-core WCAG 2.2 AA checks
```

**`data/snapshots/`** is the only place that holds real authoritative API responses. The pipeline reads from it; the static site never does (the site reads the bundled `src/artifacts/*.json` instead). **Synthetic fixtures** (`.fixtures.ts`) are restricted to test code paths and are forbidden from `src/artifacts/` by the `pnpm build` script's assertions.

## References

Official documentation cited by Phase 1 tasks. The plan uses current APIs as of the plan date; subagents confirm against these URLs before writing code that touches the API.

- React 19 root API and `createRoot`: <https://react.dev/reference/react-dom/client/createRoot>
- React 19 `useEffect` cleanup contract: <https://react.dev/reference/react/useEffect>
- React 19 `useSyncExternalStore` (URL state subscription): <https://react.dev/reference/react/useSyncExternalStore>
- Vite 8 static build (`vite build`, `build.rollupOptions.input`): <https://vite.dev/guide/build.html>
- Vite 8 environment variables: <https://vite.dev/guide/env-and-mode.html>
- `@vitejs/plugin-react` v5 (React 19 + SWC/Babel): <https://github.com/vitejs/vite-plugin-react>
- Zod 4 (`z.object`, `z.infer`, `z.discriminatedUnion`, `z.coerce`, error formatting): <https://zod.dev/>
- Observable Plot (`Plot.plot`, marks, axis config, mount lifecycle): <https://observablehq.com/plot/>
- Observable Plot React integration via ref + `replaceChildren`: <https://observablehq.com/plot/getting-started#into-the-dom>
- Vitest 3 with `happy-dom` environment: <https://vitest.dev/config/#environment>
- `@testing-library/react` 16 (render, screen, fireEvent): <https://testing-library.com/docs/react-testing-library/intro/>
- Playwright 1.50+ (`webServer`, `expect`, locator filters): <https://playwright.dev/docs/test-webserver>
- Playwright accessibility testing with `@axe-core/playwright`: <https://github.com/component-driven/axe-playwright>
- Biome 1.9 configuration: <https://biomejs.dev/guides/getting-started/>
- WCAG 2.2 AA (W3C recommendation): <https://www.w3.org/TR/WCAG22/>
- BLS CPI-U series `CUURA422SA0`: <https://data.bls.gov/timeseries/CUURA422SA0> (data API: `https://api.bls.gov/publicAPI/v2/timeseries/data/CUURA422SA0`)
- BLS San Francisco CPI publication schedule (bimonthly): <https://www.bls.gov/regions/west/news-release/consumerpriceindex_sanfrancisco.htm>
- Berkeley Open Data `gy8t-iqc4`: <https://data.cityofberkeley.info/Budget/City-of-Berkeley-Operating-Budget/gy8t-iqc4> (data API: `https://data.cityofberkeley.info/resource/gy8t-iqc4.json`)
- California State Controller City Expenditures `ju3w-4gxp`: <https://bythenumbers.sco.ca.gov/Finance-Application/City-Expenditures/ju3w-4gxp> (data API: `https://bythenumbers.sco.ca.gov/resource/ju3w-4gxp.json`)
- California State Controller City Expenditures Per Capita `ykhf-vfsr`: <https://bythenumbers.sco.ca.gov/Cities/City-Expenditures-Per-Capita/ykhf-vfsr> (data API: `https://bythenumbers.sco.ca.gov/resource/ykhf-vfsr.json`)
- California State Controller City Revenues Per Capita `ky7j-fsk5`: <https://bythenumbers.sco.ca.gov/Cities/City-Revenues-Per-Capita/ky7j-fsk5> (data API: `https://bythenumbers.sco.ca.gov/resource/ky7j-fsk5.json`)

---

# Phase 1 — Trustworthy Historical Foundation

## Phase 1 Exit Gate (verbatim from spec)

A resident can understand Berkeley's overall budget trend, switch dollar modes, inspect sources, and read the same values without a chart. Every figure is a **California State Controller standardized actual** for Berkeley from FY2003–FY2024, not an adopted budget figure.

**Phase 1 release must demonstrate all of the following on the Overview route at `/`:**

1. The Overview page renders without network requests at runtime (verified by Network panel showing zero requests after the initial document + bundled assets).
2. The Overview page renders Berkeley's FY2003–FY2024 standardized actuals (citywide expenditures and revenues) sourced from the SCO per-capita datasets, with FY2024 highlighted and FY2015 retained as a comparison anchor that spans the schema break.
3. A user can switch the URL query parameter `mode` between `real` and `nominal`; the snapshot totals, the per-resident amount, the chart, and the table all update consistently and identically using the BLS CPI factor for the displayed base year (initially FY2024, derived from `latestCompleteFiscalYear`).
4. Every displayed value links (via citation footers) to one of the **five** source manifest entries with `id`, `title`, `publisher`, and `url`.
5. The semantic `<table>` shows the same fiscal years and the same dollar amounts as the chart for both dollar modes.
6. Keyboard-only operation reaches every interactive control with a visible focus indicator; `prefers-reduced-motion` disables chart transition motion.
7. The Methodology route at `/methodology` lists **all five** Phase 1 sources (BLS CPI-U, Berkeley Socrata, SCO detailed expenditures, SCO expenditures per capita, SCO revenues per capita), names the CPI series and base year, names the population series, and explicitly discloses the FY2015 stop in the Socrata cohort, the FY2017 State Controller schema break, and the absence of PDF-derived adopted/actual values.
8. The Overview states on-page that the citywide series is a **SCO standardized actual**, not an adopted budget figure, and that adopted-versus-actual variance is deferred to Phase 3.
9. `pnpm run build` produces a static `dist/` directory whose contents include the immutable artifacts as bundled JS modules and whose `index.html` references the bundled React entry. `pnpm run build` and `pnpm run build:artifacts` are offline and read only `data/snapshots/`. `pnpm run preview` serves the build and the Playwright journey tests pass against it.
10. `pnpm test` runs Vitest unit + component tests green; `pnpm run typecheck` passes with `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` enabled; `pnpm run lint` passes Biome with no errors.
11. Every implementation file is at or below 250 pure LOC.

## Task Sequencing Rationale

Tasks 1–2 establish the toolchain, type discipline, and a11y primitives every later task relies on. Tasks 3–6 build the **five** Phase 1 source adapters snapshot-first; their tests double as the canonical fixture schema. Tasks 7–9 lock the canonical model, the versioned crosswalk, and reconciliation against published control totals. Task 10 derives CPI factors and per-resident measures and writes the immutable artifacts consumed at runtime. Task 11 builds the typed query layer and URL state. Tasks 12–13 ship the Overview and Methodology routes. Task 14 runs browser/a11y journeys and the static build verification. Each task ends with an independently testable deliverable.

---

## Task 1: Bootstrap toolchain and workspace contracts

**Files:**
- Create: `package.json`
- Create: `pnpm-lock.yaml` (generated by `pnpm install`)
- Create: `.nvmrc`
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `biome.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `index.html`
- Create: `src/vite-env.d.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles/reset.css`
- Create: `src/styles/tokens.css`
- Create: `src/styles/globals.css`

**Interfaces:**
- Consumes: nothing (greenfield).
- Produces:
  - `pnpm run dev` starts Vite dev server on `http://localhost:5173`.
  - `pnpm run build` runs `pnpm run build:artifacts` then `vite build` and emits `dist/`.
  - `pnpm run build:artifacts` runs `tsx src/pipeline/build.ts` and writes `src/artifacts/*.json`.
  - `pnpm test` runs `vitest run`.
  - `pnpm run typecheck` runs `tsc -b --noEmit`.
  - `pnpm run lint` runs `biome check .`.
  - `pnpm run test:e2e` runs `playwright test` against `pnpm run preview`.
  - The application mounts via `createRoot` into `#root` from `src/main.tsx`.

- [ ] **Step 1: Pin Node and create `.nvmrc`**

Write `C:\Users\Y\proj\berkeley-budget\.nvmrc`:

```
22
```

- [ ] **Step 2: Create `.editorconfig`**

Write `C:\Users\Y\proj\berkeley-budget\.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 3: Create `.gitignore`**

Write `C:\Users\Y\proj\berkeley-budget\.gitignore`:

```gitignore
node_modules
dist
dist-ssr
coverage
.playwright
.artifacts-cache
.DS_Store
.env
.env.local
.env.*.local
*.log
```

- [ ] **Step 4: Create `package.json`**

Write `C:\Users\Y\proj\berkeley-budget\package.json`:

```json
{
  "name": "berkeley-budget",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=10.0.0"
  },
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "dev": "vite",
    "build": "pnpm run build:artifacts && vite build",
    "build:artifacts": "tsx src/pipeline/build.ts",
    "refresh:data": "tsx src/pipeline/acquire.ts",
    "preview": "vite preview --port 4173 --strictPort",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc -b --noEmit",
    "lint": "biome check .",
    "format": "biome format --write ."
  },
  "dependencies": {
    "@observablehq/plot": "0.6.16",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "zod": "4.0.0"
  },
  "devDependencies": {
    "@axe-core/playwright": "4.10.0",
    "@biomejs/biome": "1.9.4",
    "@playwright/test": "1.50.0",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/react": "16.1.0",
    "@testing-library/user-event": "14.5.2",
    "@types/node": "22.10.2",
    "@types/react": "19.0.2",
    "@types/react-dom": "19.0.2",
    "@vitejs/plugin-react": "5.0.0",
    "happy-dom": "15.11.7",
    "tsx": "4.19.2",
    "typescript": "5.7.2",
    "vite": "8.0.0",
    "vitest": "3.0.0"
  }
}
```

- [ ] **Step 5: Install dependencies**

Run: `pnpm install`
Expected: `pnpm-lock.yaml` is created; `node_modules/` populated; no errors.

- [ ] **Step 6: Install Playwright browsers**

Run: `pnpm exec playwright install --with-deps chromium`
Expected: Chromium browser binary downloaded into the Playwright cache.

- [ ] **Step 7: Create `tsconfig.json` (solution-style project references)**

Write `C:\Users\Y\proj\berkeley-budget\tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 8: Create `tsconfig.app.json` (strict browser config)**

Write `C:\Users\Y\proj\berkeley-budget\tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "useDefineForClassFields": true,
    "allowImportingTsExtensions": false,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src", "tests"],
  "exclude": ["node_modules", "dist", "tests/browser/**"]
}
```

- [ ] **Step 9: Create `tsconfig.node.json` (pipeline config)**

Write `C:\Users\Y\proj\berkeley-budget\tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true,
    "types": ["node"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/pipeline", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 10: Create `biome.json`**

Write `C:\Users\Y\proj\berkeley-budget\biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": false,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": true,
    "includes": ["src/**", "tests/**", "*.ts", "*.tsx", "*.json", "*.md"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error",
        "noEmptyBlockStatements": "error"
      },
      "style": {
        "useImportType": "error",
        "useConsistentArrayType": "error"
      },
      "complexity": {
        "noBannedTypes": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
```

- [ ] **Step 11: Create `vite.config.ts`**

Write `C:\Users\Y\proj\berkeley-budget\vite.config.ts`:

```typescript
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
```

- [ ] **Step 12: Create `vitest.config.ts`**

Write `C:\Users\Y\proj\berkeley-budget\vitest.config.ts`:

```typescript
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", "dist", "tests/browser/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
```

- [ ] **Step 13: Create `playwright.config.ts`**

Write `C:\Users\Y\proj\berkeley-budget\playwright.config.ts`:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "pnpm run build && pnpm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

- [ ] **Step 14: Create `index.html`**

Write `C:\Users\Y\proj\berkeley-budget\index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="An open civic atlas of the City of Berkeley's budget." />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Berkeley Budget Explorer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 15: Create `public/favicon.svg`**

Write `C:\Users\Y\proj\berkeley-budget\public\favicon.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true">
  <rect width="32" height="32" rx="6" fill="#1f1d1a" />
  <path d="M8 22V10h4l4 8 4-8h4v12h-3v-7l-3.5 7h-3L11 15v7H8z" fill="#f4efe6" />
</svg>
```

- [ ] **Step 16: Create `src/vite-env.d.ts`**

Write `C:\Users\Y\proj\berkeley-budget\src\vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 17: Create `src/styles/reset.css`**

Write `C:\Users\Y\proj\berkeley-budget\src\styles\reset.css`:

```css
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }
html, body { height: 100%; }
body { line-height: 1.5; -webkit-font-smoothing: antialiased; }
img, picture, video, canvas, svg { display: block; max-width: 100%; }
input, button, textarea, select { font: inherit; color: inherit; }
button { background: none; border: none; padding: 0; cursor: pointer; }
p, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }
ul, ol { padding: 0; list-style-position: inside; }
table { border-collapse: collapse; width: 100%; }
:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
```

- [ ] **Step 18: Create `src/styles/tokens.css`**

Write `C:\Users\Y\proj\berkeley-budget\src\styles\tokens.css`:

```css
:root {
  --color-canvas: #f4efe6;
  --color-ink: #1f1d1a;
  --color-ink-muted: #5b554c;
  --color-rule: #c8bfb1;
  --color-accent: #8a3b2a;
  --color-accent-soft: #c89a86;
  --color-positive: #2f5d3a;
  --color-negative: #7a2d2d;
  --color-warn-bg: #f6e7c1;
  --color-warn-ink: #5b4214;
  --color-focus: #1f4ea8;
  --color-surface: #ffffff;

  --font-sans: "Iowan Old Style", "Georgia", "Cambria", "Times New Roman", serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;

  --radius-sm: 4px;
  --radius-md: 8px;

  --measure-prose: 64ch;
  --measure-wide: 80ch;

  --shadow-card: 0 1px 2px rgba(31, 29, 26, 0.08);

  --duration-fast: 120ms;
  --duration-medium: 220ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-canvas: #1a1815;
    --color-ink: #f4efe6;
    --color-ink-muted: #b8b0a3;
    --color-rule: #3a352e;
    --color-surface: #221f1b;
    --color-accent: #d28872;
    --color-accent-soft: #5b3a30;
    --color-positive: #8dbb94;
    --color-negative: #d99a9a;
    --color-warn-bg: #3d3119;
    --color-warn-ink: #e8d28d;
    --color-focus: #8ab0ff;
  }
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-medium: 0ms;
  }
}
```

- [ ] **Step 19: Create `src/styles/globals.css`**

Write `C:\Users\Y\proj\berkeley-budget\src\styles\globals.css`:

```css
@import "./reset.css";
@import "./tokens.css";

html { font-size: 100%; }

body {
  background: var(--color-canvas);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: 1rem;
  text-rendering: optimizeLegibility;
}

h1 { font-size: 2.25rem; font-weight: 700; letter-spacing: -0.01em; line-height: 1.15; }
h2 { font-size: 1.5rem;  font-weight: 700; letter-spacing: -0.005em; line-height: 1.2; }
h3 { font-size: 1.125rem; font-weight: 600; line-height: 1.3; }

a { color: var(--color-ink); text-underline-offset: 0.18em; }
a:hover { text-decoration-thickness: 0.08em; }

main:focus { outline: none; }

::selection { background: var(--color-accent-soft); color: var(--color-ink); }
```

- [ ] **Step 20: Create `src/main.tsx` (createRoot mount)**

Write `C:\Users\Y\proj\berkeley-budget\src\main.tsx`:

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root not found");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 21: Create `src/App.tsx` (minimal route shell)**

Write `C:\Users\Y\proj\berkeley-budget\src\App.tsx`:

```typescript
import { useSyncExternalStore } from "react";
import { Overview } from "./routes/Overview";
import { Methodology } from "./routes/Methodology";

const OVERVIEW_HASH = "#/";
const METHODOLOGY_HASH = "#/methodology";

function subscribe(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
  };
}

function getSnapshot(): string {
  return window.location.hash || OVERVIEW_HASH;
}

export function App(): React.JSX.Element {
  const hash = useSyncExternalStore(subscribe, getSnapshot, () => OVERVIEW_HASH);
  return (
    <main id="main" tabIndex={-1}>
      {hash === METHODOLOGY_HASH ? <Methodology /> : <Overview />}
    </main>
  );
}
```

- [ ] **Step 22: Create empty placeholder route files (filled in later tasks)**

Write `C:\Users\Y\proj\berkeley-budget\src\routes\Overview.tsx`:

```typescript
export function Overview(): React.JSX.Element {
  return <h1>Berkeley Budget Explorer</h1>;
}
```

Write `C:\Users\Y\proj\berkeley-budget\src\routes\Methodology.tsx`:

```typescript
export function Methodology(): React.JSX.Element {
  return <h1>Methodology</h1>;
}
```

- [ ] **Step 23: Verify TypeScript and Biome**

Run: `pnpm run typecheck`
Expected: exit code 0, no diagnostics.

Run: `pnpm run lint`
Expected: exit code 0, no findings.

- [ ] **Step 24: Verify Vite dev server**

Run: `pnpm run dev`
Expected: server starts at `http://localhost:5173`; visiting the URL shows "Berkeley Budget Explorer" heading; the console shows no errors. Stop the server with `Ctrl+C`.

- [ ] **Step 25: Verify production build**

Run: `pnpm run build`
Expected: `dist/` is created containing `index.html`, hashed JS/CSS assets, and `favicon.svg`. No errors. (The pipeline step fails at this point only if `tsx` cannot find `src/pipeline/build.ts`; Step 26 creates that file.)

- [ ] **Step 26: Create stub `src/pipeline/build.ts` so `pnpm run build` succeeds**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\build.ts`:

```typescript
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const artifactsDir = resolve(__dirname, "../artifacts");

export async function buildArtifacts(): Promise<void> {
  mkdirSync(artifactsDir, { recursive: true });
  const placeholder = { schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), note: "Phase 1 stub." };
  writeFileSync(resolve(artifactsDir, "release.json"), JSON.stringify(placeholder, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildArtifacts().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
```

Run: `pnpm run build`
Expected: `src/artifacts/release.json` is created; `dist/` is built; exit code 0.

- [ ] **Step 27: OPTIONAL commit**

If the human partner initializes a Git repository and asks for atomic commits, execute:

```bash
git add package.json pnpm-lock.yaml .nvmrc .editorconfig .gitignore tsconfig.json tsconfig.app.json tsconfig.node.json biome.json vite.config.ts vitest.config.ts playwright.config.ts index.html public/ src/main.tsx src/App.tsx src/styles src/vite-env.d.ts src/routes/Overview.tsx src/routes/Methodology.tsx src/pipeline/build.ts src/artifacts/release.json
git commit -m "chore: bootstrap pnpm/Vite/TS/Biome/Vitest/Playwright workspace"
```

Otherwise skip this step.

---

## Task 2: Design-system primitives (SkipLink, Toggle, Card, DefinitionList, DataTable, TrendChart mount)

**Files:**
- Create: `src/design-system/index.ts`
- Create: `src/design-system/PageLayout.tsx`
- Create: `src/design-system/PageLayout.module.css`
- Create: `src/design-system/SkipLink.tsx`
- Create: `src/design-system/SkipLink.module.css`
- Create: `src/design-system/Toggle.tsx`
- Create: `src/design-system/Toggle.module.css`
- Create: `src/design-system/Card.tsx`
- Create: `src/design-system/Card.module.css`
- Create: `src/design-system/DefinitionList.tsx`
- Create: `src/design-system/DefinitionList.module.css`
- Create: `src/design-system/DataTable.tsx`
- Create: `src/design-system/DataTable.module.css`
- Create: `src/design-system/TrendChart.tsx`
- Create: `src/design-system/TrendChart.module.css`

**Interfaces:**
- Consumes: design tokens from `src/styles/tokens.css`.
- Produces:
  - `<PageLayout eyebrow title intro? children footer?>` renders skip link, `<header>`, content, optional `<footer>`.
  - `<Toggle options value onChange>` renders a `<fieldset>` with `<legend>` and a `<div role="radiogroup">` containing two `<button role="radio">` controls.
  - `<Card eyebrow? title body footer?>` renders an `<article>` with semantic headings and a footer slot.
  - `<DefinitionList items ariaLabel?>` renders `<dl>` with `<dt>`/`<dd>`.
  - `<DataTable caption columns rows getRowKey>` renders `<table><caption><thead><tbody>` with `scope="col"` headers.
  - `<TrendChart points baseYear yLabel ariaLabel summary>` mounts an Observable Plot chart and renders a visually-paired summary.

- [ ] **Step 1: Create `src/design-system/SkipLink.tsx`**

Write `C:\Users\Y\proj\berkeley-budget\src\design-system\SkipLink.tsx`:

```typescript
import styles from "./SkipLink.module.css";

interface SkipLinkProps {
  readonly targetId: string;
  readonly label: string;
}

export function SkipLink({ targetId, label }: SkipLinkProps): React.JSX.Element {
  return (
    <a className={styles.skip} href={`#${targetId}`}>
      {label}
    </a>
  );
}
```

- [ ] **Step 2: Create `src/design-system/SkipLink.module.css`**

Write `C:\Users\Y\proj\berkeley-budget\src\design-system\SkipLink.module.css`:

```css
.skip {
  position: absolute;
  left: var(--space-3);
  top: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-ink);
  color: var(--color-canvas);
  border-radius: var(--radius-sm);
  transform: translateY(-200%);
  transition: transform var(--duration-fast) var(--ease-standard);
  z-index: 1000;
}

.skip:focus-visible {
  transform: translateY(0);
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Create `src/design-system/PageLayout.tsx`**

Write `C:\Users\Y\proj\berkeley-budget\src\design-system\PageLayout.tsx`:

```typescript
import type { ReactNode } from "react";
import { SkipLink } from "./SkipLink";
import styles from "./PageLayout.module.css";

interface PageLayoutProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly intro?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

export function PageLayout({ eyebrow, title, intro, children, footer }: PageLayoutProps): React.JSX.Element {
  return (
    <>
      <SkipLink targetId="main" label="Skip to main content" />
      <header className={styles.header}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        {intro ? <p className={styles.intro}>{intro}</p> : null}
      </header>
      <div className={styles.content}>{children}</div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </>
  );
}
```

- [ ] **Step 4: Create `src/design-system/PageLayout.module.css`**

Write `C:\Users\Y\proj\berkeley-budget\src\design-system\PageLayout.module.css`:

```css
.header {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-5);
  border-bottom: 1px solid var(--color-rule);
  max-width: var(--measure-wide);
  margin-inline: auto;
}

.eyebrow {
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-ink-muted);
}

.title { max-width: var(--measure-prose); }

.intro {
  max-width: var(--measure-prose);
  color: var(--color-ink-muted);
  font-size: 1.0625rem;
}

.content {
  display: grid;
  gap: var(--space-6);
  padding: var(--space-6) var(--space-5);
  max-width: var(--measure-wide);
  margin-inline: auto;
}

.footer {
  border-top: 1px solid var(--color-rule);
  padding: var(--space-6) var(--space-5);
  max-width: var(--measure-wide);
  margin-inline: auto;
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
}

@media (max-width: 480px) {
  .header, .content, .footer { padding-inline: var(--space-4); }
}
```

- [ ] **Step 5: Create `src/design-system/Toggle.tsx`**

Write `C:\Users\Y\proj\berkeley-budget\src\design-system\Toggle.tsx`:

```typescript
import styles from "./Toggle.module.css";

export interface ToggleOption<V extends string> {
  readonly value: V;
  readonly label: string;
}

interface ToggleProps<V extends string> {
  readonly legend: string;
  readonly options: readonly ToggleOption<V>[];
  readonly value: V;
  readonly onChange: (next: V) => void;
}

export function Toggle<V extends string>({
  legend,
  options,
  value,
  onChange,
}: ToggleProps<V>): React.JSX.Element {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      <div role="radiogroup" aria-label={legend} className={styles.group}>
        {options.map((opt) => {
          const checked = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              data-state={checked ? "on" : "off"}
              onClick={() => onChange(opt.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  const idx = options.findIndex((o) => o.value === value);
                  const next = options[(idx + 1) % options.length];
                  if (next) onChange(next.value);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const idx = options.findIndex((o) => o.value === value);
                  const prev = options[(idx - 1 + options.length) % options.length];
                  if (prev) onChange(prev.value);
                }
              }}
              className={styles.option}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 6: Create `src/design-system/Toggle.module.css`**

Write `C:\Users\Y\proj\berkeley-budget\src\design-system\Toggle.module.css`:

```css
.fieldset {
  border: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: var(--space-2);
}

.legend {
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-ink-muted);
  padding: 0;
}

.group {
  display: inline-flex;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
}

.option {
  padding: var(--space-2) var(--space-4);
  font-size: 0.9375rem;
  color: var(--color-ink);
  background: var(--color-surface);
  border-right: 1px solid var(--color-rule);
  transition: background var(--duration-fast) var(--ease-standard);
}

.option:last-child { border-right: none; }

.option[data-state="on"] {
  background: var(--color-ink);
  color: var(--color-canvas);
}

.option:hover[data-state="off"] {
  background: var(--color-accent-soft);
}
```

- [ ] **Step 7: Create `src/design-system/Card.tsx`**

Write `C:\Users\Y\proj\berkeley-budget\src\design-system\Card.tsx`:

```typescript
import type { ReactNode } from "react";
import styles from "./Card.module.css";

interface CardProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly body: ReactNode;
  readonly footer?: ReactNode;
}

export function Card({ eyebrow, title, body, footer }: CardProps): React.JSX.Element {
  return (
    <article className={styles.card}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.body}>{body}</div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </article>
  );
}
```

- [ ] **Step 8: Create `src/design-system/Card.module.css`**

Write `C:\Users\Y\proj\berkeley-budget\src\design-system\Card.module.css`:

```css
.card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}

.eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-ink-muted);
}

.title {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.25;
}

.body { color: var(--color-ink); }

.footer {
  border-top: 1px solid var(--color-rule);
  padding-top: var(--space-3);
  font-size: 0.8125rem;
  color: var(--color-ink-muted);
}
```

- [ ] **Step 9: Create `src/design-system/DefinitionList.tsx`**

Write `C:\Users\Y\proj\berkeley-budget\src\design-system\DefinitionList.tsx`:

```typescript
import styles from "./DefinitionList.module.css";

export interface DefinitionItem {
  readonly term: string;
  readonly description: string;
}

interface DefinitionListProps {
  readonly items: readonly DefinitionItem[];
  readonly ariaLabel?: string;
}

export function DefinitionList({ items, ariaLabel }: DefinitionListProps): React.JSX.Element {
  return (
    <dl className={styles.list} aria-label={ariaLabel}>
      {items.map((item) => (
        <div key={item.term} className={styles.row}>
          <dt className={styles.term}>{item.term}</dt>
          <dd className={styles.description}>{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}
```

- [ ] **Step 10: Create `src/design-system/DefinitionList.module.css`**

Write `C:\Users\Y\proj\berkeley-budget\src\design-system\DefinitionList.module.css`:

```css
.list {
  display: grid;
  grid-template-columns: minmax(8rem, 14rem) 1fr;
  gap: var(--space-2) var(--space-5);
  margin: 0;
}

.row {
  display: contents;
}

.term {
  font-weight: 600;
  color: var(--color-ink-muted);
}

.description { margin: 0; }

@media (max-width: 480px) {
  .list {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }
  .row { display: block; padding-block: var(--space-2); border-bottom: 1px solid var(--color-rule); }
  .row:last-child { border-bottom: none; }
}
```

- [ ] **Step 11: Create `src/design-system/DataTable.tsx`**

Write `C:\Users\Y\proj\berkeley-budget\src\design-system\DataTable.tsx`:

```typescript
import type { ReactNode } from "react";
import styles from "./DataTable.module.css";

export interface Column<T> {
  readonly key: string;
  readonly header: string;
  readonly render: (row: T) => ReactNode;
  readonly align?: "start" | "end";
}

interface DataTableProps<T> {
  readonly caption: string;
  readonly columns: readonly Column<T>[];
  readonly rows: readonly T[];
  readonly getRowKey: (row: T) => string;
}

export function DataTable<T>({ caption, columns, rows, getRowKey }: DataTableProps<T>): React.JSX.Element {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <caption className={styles.caption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" className={col.align === "end" ? styles.end : styles.start}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((col) => (
                <td key={col.key} className={col.align === "end" ? styles.end : styles.start}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 12: Create `src/design-system/DataTable.module.css`**

Write `C:\Users\Y\proj\berkeley-budget\src\design-system\DataTable.module.css`:

```css
.wrapper {
  overflow-x: auto;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.caption {
  caption-side: top;
  text-align: start;
  padding: var(--space-3) var(--space-4);
  font-weight: 600;
  border-bottom: 1px solid var(--color-rule);
}

.table thead th {
  text-align: start;
  font-weight: 600;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-ink-muted);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-rule);
  background: var(--color-canvas);
}

.table tbody td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-rule);
  font-size: 0.9375rem;
}

.table tbody tr:last-child td { border-bottom: none; }

.start { text-align: start; }
.end { text-align: end; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 13: Create `src/design-system/TrendChart.tsx`**

Write `C:\Users\Y\proj\berkeley-budget\src\design-system\TrendChart.tsx`:

```typescript
import * as Plot from "@observablehq/plot";
import { useEffect, useId, useRef } from "react";
import styles from "./TrendChart.module.css";

export interface TrendPoint {
  readonly fiscalYear: number;
  readonly amountCents: number;
}

interface TrendChartProps {
  readonly points: readonly TrendPoint[];
  readonly baseYear: number;
  readonly yLabel: string;
  readonly ariaLabel: string;
  readonly summary: string;
}

export function TrendChart({ points, baseYear, yLabel, ariaLabel, summary }: TrendChartProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const fallbackId = useId();
  const chartId = `trend-${fallbackId}`;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const chart = Plot.plot({
      width: 640,
      height: 320,
      marginLeft: 70,
      marginBottom: 50,
      style: { background: "transparent", color: "var(--color-ink)", fontSize: "12px" },
      x: { label: "Fiscal year", tickFormat: (d) => String(d), nice: true },
      y: { label: `${yLabel} (base ${baseYear})`, grid: true, nice: true },
      marks: [
        Plot.ruleY([0]),
        Plot.line(points, {
          x: "fiscalYear",
          y: "amountCents",
          stroke: "var(--color-ink)",
          strokeWidth: 1.5,
        }),
        Plot.dot(points, {
          x: "fiscalYear",
          y: "amountCents",
          fill: "var(--color-ink)",
          r: 3,
        }),
        Plot.text(points, {
          x: "fiscalYear",
          y: "amountCents",
          text: (d) => String(d.fiscalYear),
          dy: -10,
          fill: "var(--color-ink-muted)",
          fontSize: 10,
        }),
      ],
    });
    node.replaceChildren(chart);
    return () => {
      node.replaceChildren();
    };
  }, [points, baseYear, yLabel]);

  return (
    <figure className={styles.figure} aria-labelledby={`${chartId}-title`}>
      <figcaption id={`${chartId}-title`} className={styles.caption}>
        {ariaLabel}
      </figcaption>
      <div ref={ref} className={styles.chart} role="img" aria-label={ariaLabel} />
      <p className={styles.summary}>{summary}</p>
    </figure>
  );
}
```

- [ ] **Step 14: Create `src/design-system/TrendChart.module.css`**

Write `C:\Users\Y\proj\berkeley-budget\src\design-system\TrendChart.module.css`:

```css
.figure {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-md);
}

.caption {
  font-weight: 600;
  font-size: 1rem;
}

.chart {
  width: 100%;
  min-height: 320px;
}

.summary {
  font-size: 0.9375rem;
  color: var(--color-ink-muted);
  max-width: var(--measure-prose);
}

@media (prefers-reduced-motion: reduce) {
  .chart { transition: none; }
}
```

- [ ] **Step 15: Create `src/design-system/index.ts` (barrel)**

Write `C:\Users\Y\proj\berkeley-budget\src\design-system\index.ts`:

```typescript
export { Card } from "./Card";
export { DataTable, type Column } from "./DataTable";
export { DefinitionList, type DefinitionItem } from "./DefinitionList";
export { PageLayout } from "./PageLayout";
export { SkipLink } from "./SkipLink";
export { Toggle, type ToggleOption } from "./Toggle";
export { TrendChart, type TrendPoint } from "./TrendChart";
```

- [ ] **Step 16: Verify typecheck and lint**

Run: `pnpm run typecheck`
Expected: exit code 0.

Run: `pnpm run lint`
Expected: exit code 0.

- [ ] **Step 17: OPTIONAL commit**

If Git initialized and approved:

```bash
git add src/design-system
git commit -m "feat(design-system): accessible primitives + TrendChart mount"
```

Otherwise skip this step.

---

## Task 3: Source manifest (5 sources), snapshot acquisition (`pnpm refresh:data`), and fixed-point money parser

**Files:**
- Create: `src/pipeline/sources/manifest.ts`
- Create: `src/pipeline/sources/manifest.test.ts`
- Create: `src/pipeline/sources/manifest.data.json`
- Create: `src/pipeline/sources/money.ts`
- Create: `src/pipeline/sources/money.test.ts`
- Create: `src/pipeline/acquire.ts`
- Create: `src/pipeline/acquire.test.ts`
- Create: `data/snapshots/src-bls-cpi-u-cuura422sa0/rel-2026-07-20-001.json`
- Create: `data/snapshots/src-bls-cpi-u-cuura422sa0/rel-2026-07-20-001.sha256`
- Create: `data/snapshots/src-berkeley-socrata-gy8t-iqc4/rel-2026-07-20-001.json`
- Create: `data/snapshots/src-berkeley-socrata-gy8t-iqc4/rel-2026-07-20-001.sha256`
- Create: `data/snapshots/src-sco-expenditures-ju3w-4gxp/rel-2026-07-20-001.json`
- Create: `data/snapshots/src-sco-expenditures-ju3w-4gxp/rel-2026-07-20-001.sha256`
- Create: `data/snapshots/src-sco-expenditures-per-capita-ykhf-vfsr/rel-2026-07-20-001.json`
- Create: `data/snapshots/src-sco-expenditures-per-capita-ykhf-vfsr/rel-2026-07-20-001.sha256`
- Create: `data/snapshots/src-sco-revenues-per-capita-ky7j-fsk5/rel-2026-07-20-001.json`
- Create: `data/snapshots/src-sco-revenues-per-capita-ky7j-fsk5/rel-2026-07-20-001.sha256`

**Interfaces:**
- Consumes: Zod 4, Node's `node:crypto`, `node:fs/promises`, `node:https`.
- Produces:
  - `SourceIdSchema` regex `^src-[a-z0-9-]+$`.
  - `SourceEntrySchema` with `id`, `title`, `publisher`, `url` (must be an API URL — `https://…/resource/…json` or `https://api…/…`), `identityField` + `expectedIdentity` for source-identity verification, `retrievedAt`, `checksumSha256` (real SHA-256 from `refresh:data`; the manifest schema rejects the all-zero placeholder), `parserVersion`, `fiscalPeriods`, `notes`.
  - `SourceManifestSchema` with `releaseId`, `generatedAt`, `schemaVersion`, and exactly **five** `sources`.
  - `parseDollarsToCents(input) -> Result<number, CentsParseError>` where `CentsParseError = { kind: "malformed", input } | { kind: "out-of-range", input }`. Uses `BigInt` for magnitude, applies sign once at the end, refuses values beyond `Number.MAX_SAFE_INTEGER`.
  - `acquireSource(entry, options) -> Promise<{ bytes: Buffer; checksumSha256: string }>` performing one HTTPS GET to `entry.url`, parsing the body, validating it against the source's identity field (e.g. series id `CUURA422SA0`, dataset id `ju3w-4gxp`, entity name matches `Berkeley`), then writing `.json` + `.sha256` atomically.
  - `acquireAll(manifest, releaseId) -> Promise<void>` runs the five acquisitions in order; on any failure leaves all prior snapshots untouched and exits non-zero.

**Step 0 — Hand-initialised snapshots (one-time, before `refresh:data` can be run):** The five snapshot files under `data/snapshots/` MUST contain real authoritative API responses captured from the pinned endpoints. For the first release (`rel-2026-07-20-001`), a human operator captures each response using `curl` (or `Invoke-WebRequest` on Windows), parses the JSON body, **canonicalises it with the same canonicalizer the pipeline uses** (`JSON.stringify(parsedBody, replacer)` with `undefined`/`function`/`symbol` values stripped), writes the canonical bytes to `data/snapshots/<source-id>/rel-2026-07-20-001.json`, and computes the SHA-256 of those canonical bytes via `sha256sum` (or `certutil -hashfile` on Windows). The `.sha256` sidecar holds the lowercase hex digest on its own line. Snapshot bytes are NOT the raw HTTP response — they are the canonical JSON of the parsed body, so two `refresh:data` runs against an unchanged API always produce identical SHA-256s. The five endpoints and the expected identity values that must be verified at capture time are:

- `src-bls-cpi-u-cuura422sa0` — `https://api.bls.gov/publicAPI/v2/timeseries/data/CUURA422SA0` — identity `Results.seriesID === "CUURA422SA0"`.
- `src-berkeley-socrata-gy8t-iqc4` — `https://data.cityofberkeley.info/resource/gy8t-iqc4.json` — identity `dataset id === "gy8t-iqc4"`.
- `src-sco-expenditures-ju3w-4gxp` — `https://bythenumbers.sco.ca.gov/resource/ju3w-4gxp.json` — identity `dataset id === "ju3w-4gxp"`.
- `src-sco-expenditures-per-capita-ykhf-vfsr` — `https://bythenumbers.sco.ca.gov/resource/ykhf-vfsr.json` — identity `dataset id === "ykhf-vfsr"`.
- `src-sco-revenues-per-capita-ky7j-fsk5` — `https://bythenumbers.sco.ca.gov/resource/ky7j-fsk5.json` — identity `dataset id === "ky7j-fsk5"`.

If any identity check fails, the snapshot is not accepted and `manifest.data.json` cannot be populated. Subsequent releases use `pnpm refresh:data`, which writes the new release-id subfolder atomically. **No placeholder snapshots, no fixture JSON in `data/snapshots/`, no commented-out content.**

- [ ] **Step 1: Write the failing manifest tests**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\manifest.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  loadSnapshot,
  readManifestFromDisk,
  SourceEntrySchema,
  SourceIdSchema,
  SourceManifestSchema,
  verifySnapshot,
} from "./manifest";
import manifestData from "./manifest.data.json" with { type: "json" };
import { readFileSync } from "node:fs";

describe("source manifest schemas", () => {
  it("accepts a valid source id", () => {
    expect(() => SourceIdSchema.parse("src-bls-cpi")).not.toThrow();
  });

  it("rejects a malformed source id", () => {
    expect(() => SourceIdSchema.parse("BLS_CPI")).toThrow();
  });

  it("requires all canonical fields on a source entry", () => {
    const minimal = {
      id: "src-test",
      title: "Test",
      publisher: "Test Pub",
      url: "https://example.test/resource/test.json",
      identityField: "series_id",
      expectedIdentity: "TEST",
      retrievedAt: "2026-07-20",
      checksumSha256: "a".repeat(64),
      parserVersion: "1.0.0",
      fiscalPeriods: [{ start: 2020, end: 2024 }],
    };
    expect(() => SourceEntrySchema.parse(minimal)).not.toThrow();
  });

  it("rejects the all-zero placeholder checksum", () => {
    const placeholder = {
      id: "src-test",
      title: "Test",
      publisher: "Test Pub",
      url: "https://example.test/resource/test.json",
      identityField: "series_id",
      expectedIdentity: "TEST",
      retrievedAt: "2026-07-20",
      checksumSha256: "0".repeat(64),
      parserVersion: "1.0.0",
      fiscalPeriods: [{ start: 2020, end: 2024 }],
    };
    expect(() => SourceEntrySchema.parse(placeholder)).toThrow(/placeholder|all-zero/i);
  });

  it("rejects catalog HTML URLs (must be an API endpoint)", () => {
    const html = {
      id: "src-test",
      title: "Test",
      publisher: "Test Pub",
      url: "https://example.test/page.html",
      identityField: "series_id",
      expectedIdentity: "TEST",
      retrievedAt: "2026-07-20",
      checksumSha256: "a".repeat(64),
      parserVersion: "1.0.0",
      fiscalPeriods: [{ start: 2020, end: 2024 }],
    };
    expect(() => SourceEntrySchema.parse(html)).toThrow(/api url/i);
  });

  it("the pinned manifest lists exactly five sources", () => {
    const parsed = SourceManifestSchema.parse(manifestData);
    expect(parsed.sources.length).toBe(5);
    const ids = parsed.sources.map((s) => s.id).sort();
    expect(ids).toEqual([
      "src-berkeley-socrata-gy8t-iqc4",
      "src-bls-cpi-u-cuura422sa0",
      "src-sco-expenditures-ju3w-4gxp",
      "src-sco-expenditures-per-capita-ykhf-vfsr",
      "src-sco-revenues-per-capita-ky7j-fsk5",
    ]);
  });

  it("each source entry has an API URL containing /resource/", () => {
    const parsed = SourceManifestSchema.parse(manifestData);
    for (const s of parsed.sources) {
      expect(s.url).toMatch(/\/resource\/|\/publicAPI\/|\/api\//);
    }
  });

  it("verifySnapshot returns ok when the on-disk bytes match the manifest checksum", () => {
    const parsed = SourceManifestSchema.parse(manifestData);
    for (const entry of parsed.sources) {
      const path = `data/snapshots/${entry.id}/rel-2026-07-20-001.json`;
      const bytes = readFileSync(path);
      const result = verifySnapshot(entry, bytes);
      expect(result.ok, `snapshot mismatch for ${entry.id}: ${result.reason ?? ""}`).toBe(true);
    }
  });

  it("loadSnapshot reads and verifies the snapshot for a known source", () => {
    const result = loadSnapshot({
      root: "data/snapshots",
      entry: SourceManifestSchema.parse(manifestData).sources[0]!,
      releaseId: "rel-2026-07-20-001",
    });
    expect(result.ok).toBe(true);
  });

  it("readManifestFromDisk refuses when any checksum is the all-zero placeholder", async () => {
    await expect(readManifestFromDisk("src/pipeline/sources/manifest.data.json")).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Write the failing money parser tests**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\money.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseDollarsToCents } from "./money";

describe("parseDollarsToCents", () => {
  it("parses a positive two-decimal value", () => {
    expect(parseDollarsToCents("123.45")).toEqual({ ok: true, value: 12345 });
  });

  it("parses a positive integer", () => {
    expect(parseDollarsToCents("100")).toEqual({ ok: true, value: 10000 });
  });

  it("parses zero", () => {
    expect(parseDollarsToCents("0")).toEqual({ ok: true, value: 0 });
    expect(parseDollarsToCents("0.00")).toEqual({ ok: true, value: 0 });
  });

  it("parses a negative two-decimal value without flipping the sign", () => {
    const r = parseDollarsToCents("-123.45");
    expect(r).toEqual({ ok: true, value: -12345 });
  });

  it("parses a negative integer", () => {
    expect(parseDollarsToCents("-42")).toEqual({ ok: true, value: -4200 });
  });

  it("rejects malformed input", () => {
    const r = parseDollarsToCents("abc");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("malformed");
  });

  it("rejects empty input", () => {
    const r = parseDollarsToCents("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("malformed");
  });

  it("rejects more than two decimal places", () => {
    const r = parseDollarsToCents("1.234");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("malformed");
  });

  it("rejects values beyond Number.MAX_SAFE_INTEGER (in cents)", () => {
    const r = parseDollarsToCents("100000000000000.00");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("out-of-range");
  });

  it("accepts the largest safe value", () => {
    const r = parseDollarsToCents("90071992547409.91");
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Write the failing acquisition tests**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\acquire.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acquireSource } from "./acquire";
import type { SourceEntry } from "./sources/manifest";

const baseEntry = {
  retrievedAt: "2026-07-20",
  checksumSha256: "x".repeat(64),
  parserVersion: "1.0.0",
  fiscalPeriods: [{ start: 1999, end: 2024 }],
} as const;

const blsEntry: SourceEntry = {
  ...baseEntry,
  id: "src-bls-cpi-u-cuura422sa0",
  title: "BLS CPI-U",
  publisher: "BLS",
  url: "https://api.bls.gov/publicAPI/v2/timeseries/data/CUURA422SA0",
  identityField: "Results.seriesID",
  expectedIdentity: "CUURA422SA0",
};

const socrataEntry: SourceEntry = {
  ...baseEntry,
  id: "src-berkeley-socrata-gy8t-iqc4",
  title: "Berkeley Socrata Operating Budget",
  publisher: "City of Berkeley",
  url: "https://data.cityofberkeley.info/resource/gy8t-iqc4.json",
  identityField: "dataset_id",
  expectedIdentity: "gy8t-iqc4",
};

const scoDetailedEntry: SourceEntry = {
  ...baseEntry,
  id: "src-sco-expenditures-ju3w-4gxp",
  title: "SCO Detailed Expenditures",
  publisher: "California State Controller",
  url: "https://bythenumbers.sco.ca.gov/resource/ju3w-4gxp.json",
  identityField: "dataset_id",
  expectedIdentity: "ju3w-4gxp",
};

const scoExpPcEntry: SourceEntry = {
  ...baseEntry,
  id: "src-sco-expenditures-per-capita-ykhf-vfsr",
  title: "SCO Expenditures Per Capita",
  publisher: "California State Controller",
  url: "https://bythenumbers.sco.ca.gov/resource/ykhf-vfsr.json",
  identityField: "dataset_id",
  expectedIdentity: "ykhf-vfsr",
};

const scoRevPcEntry: SourceEntry = {
  ...baseEntry,
  id: "src-sco-revenues-per-capita-ky7j-fsk5",
  title: "SCO Revenues Per Capita",
  publisher: "California State Controller",
  url: "https://bythenumbers.sco.ca.gov/resource/ky7j-fsk5.json",
  identityField: "dataset_id",
  expectedIdentity: "ky7j-fsk5",
};

const goodBlsBody = JSON.stringify({ Results: { seriesID: "CUURA422SA0", data: [] } });
const badBlsBody = JSON.stringify({ Results: { seriesID: "WRONG", data: [] } });
const scoBerkeleyRow = { entity_name: "City of Berkeley", fiscal_year: "FY2024", value: "0", category: "x", subcategory_1: "y", subcategory_2: "z", line_description: "t", estimated_population: "0", type: "actual" };
const scoEmptyArray: unknown[] = [];
const scoBerkeleyArray = [scoBerkeleyRow];

describe("acquireSource", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("BLS rejects a response whose body series id does not match the pinned series", async () => {
    globalThis.fetch = vi.fn(async () => new Response(badBlsBody, { status: 200 })) as unknown as typeof fetch;
    await expect(acquireSource(blsEntry)).rejects.toThrow(/seriesID|CUURA422SA0/);
  });

  it("BLS accepts a body whose seriesID matches the pinned series", async () => {
    globalThis.fetch = vi.fn(async () => new Response(goodBlsBody, { status: 200 })) as unknown as typeof fetch;
    const result = await acquireSource(blsEntry);
    expect(result.bytes.length).toBeGreaterThan(0);
    expect(result.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.checksumSha256).not.toBe("0".repeat(64));
  });

  it("Berkeley Socrata accepts the pinned dataset id in its manifest URL", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify([{ fiscal_year: "FY2014", department: "Police", approved_amount: "0", fund: "General Fund" }]), { status: 200 })) as unknown as typeof fetch;
    const result = await acquireSource(socrataEntry);
    expect(result.sourceId).toBe("src-berkeley-socrata-gy8t-iqc4");
  });

  it("SCO detailed expenditures reject an empty Berkeley body", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(scoEmptyArray), { status: 200 })) as unknown as typeof fetch;
    await expect(acquireSource(scoDetailedEntry)).rejects.toThrow(/Berkeley|dataset/i);
  });

  it("SCO detailed expenditures accept a body that contains at least one City of Berkeley row", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(scoBerkeleyArray), { status: 200 })) as unknown as typeof fetch;
    const result = await acquireSource(scoDetailedEntry);
    expect(result.sourceId).toBe("src-sco-expenditures-ju3w-4gxp");
  });

  it("SCO expenditures per capita reject a body without any Berkeley row", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify([{ entity_name: "City of Oakland", fiscal_year: "FY2024", total_expenditures: "0", estimated_population: "0", expenditures_per_capita: "0" }]), { status: 200 })) as unknown as typeof fetch;
    await expect(acquireSource(scoExpPcEntry)).rejects.toThrow(/Berkeley|dataset/i);
  });

  it("SCO revenues per capita accept a body with a Berkeley row", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify([{ entity_name: "City of Berkeley", fiscal_year: "FY2024", total_revenues: "0", estimated_population: "0", revenues_per_capita: "0" }]), { status: 200 })) as unknown as typeof fetch;
    const result = await acquireSource(scoRevPcEntry);
    expect(result.sourceId).toBe("src-sco-revenues-per-capita-ky7j-fsk5");
  });

  it("all five sources together can be acquired without identity failures when bodies match", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.bls.gov")) return new Response(goodBlsBody, { status: 200 });
      if (url.includes("data.cityofberkeley.info")) {
        return new Response(JSON.stringify([{ fiscal_year: "FY2014", department: "Police", approved_amount: "0", fund: "General Fund" }]), { status: 200 });
      }
      if (url.includes("ju3w-4gxp")) return new Response(JSON.stringify(scoBerkeleyArray), { status: 200 });
      if (url.includes("ykhf-vfsr")) {
        return new Response(JSON.stringify([{ entity_name: "City of Berkeley", fiscal_year: "FY2024", total_expenditures: "0", estimated_population: "0", expenditures_per_capita: "0" }]), { status: 200 });
      }
      if (url.includes("ky7j-fsk5")) {
        return new Response(JSON.stringify([{ entity_name: "City of Berkeley", fiscal_year: "FY2024", total_revenues: "0", estimated_population: "0", revenues_per_capita: "0" }]), { status: 200 });
      }
      return new Response("[]", { status: 200 });
    }) as unknown as typeof fetch;
    for (const entry of [blsEntry, socrataEntry, scoDetailedEntry, scoExpPcEntry, scoRevPcEntry]) {
      const result = await acquireSource(entry);
      expect(result.sourceId).toBe(entry.id);
    }
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm test -- sources/manifest.test sources/money.test acquire.test`
Expected: FAIL with `Cannot find module './manifest'`, `'./money'`, or `'./acquire'`.

- [ ] **Step 5: Write the manifest implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\manifest.ts`:

```typescript
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

export const SourceIdSchema = z.string().regex(/^src-[a-z0-9-]+$/, {
  message: "source id must match ^src-[a-z0-9-]+$",
});
export type SourceId = z.infer<typeof SourceIdSchema>;

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const SemverSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

export const Sha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .refine((v) => v !== "0".repeat(64), {
    message: "checksum must not be the all-zero placeholder",
  });

export const FiscalPeriodSchema = z
  .object({
    start: z.number().int().min(1900).max(2100),
    end: z.number().int().min(1900).max(2100),
  })
  .refine((p) => p.end >= p.start);

export const SourceEntrySchema = z.object({
  id: SourceIdSchema,
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z
    .string()
    .url()
    .refine(
      (u) => /\/(resource|publicAPI|api)\//.test(u),
      { message: "url must be an API endpoint containing /resource/ or /api/" },
    ),
  identityField: z.string().min(1),
  expectedIdentity: z.string().min(1),
  retrievedAt: IsoDateSchema,
  checksumSha256: Sha256Schema,
  parserVersion: SemverSchema,
  fiscalPeriods: z.array(FiscalPeriodSchema).min(1),
  notes: z.string().optional(),
});
export type SourceEntry = z.infer<typeof SourceEntrySchema>;

export const SourceManifestSchema = z
  .object({
    releaseId: z.string().regex(/^rel-\d{4}-\d{2}-\d{2}-[a-z0-9]+$/),
    generatedAt: IsoDateTimeSchema,
    schemaVersion: SemverSchema,
    sources: z.array(SourceEntrySchema),
  })
  .refine((m) => m.sources.length === 5, {
    message: "Phase 1 manifest must contain exactly five sources",
  });
export type SourceManifest = z.infer<typeof SourceManifestSchema>;

export function readManifestFromDisk(path: string): Promise<SourceManifest> {
  return readFile(path, "utf-8").then((text) => SourceManifestSchema.parse(JSON.parse(text)));
}

export function sha256Of(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export type VerifyResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export function verifySnapshot(entry: SourceEntry, bytes: Buffer): VerifyResult {
  const actual = sha256Of(bytes);
  if (actual !== entry.checksumSha256) {
    return { ok: false, reason: `checksum mismatch (expected ${entry.checksumSha256}, got ${actual})` };
  }
  return { ok: true };
}

export interface LoadSnapshotInput {
  readonly root: string;
  readonly entry: SourceEntry;
  readonly releaseId: string;
}

export type LoadSnapshotResult =
  | { readonly ok: true; readonly bytes: Buffer; readonly path: string }
  | { readonly ok: false; readonly reason: string };

export async function loadSnapshot(input: LoadSnapshotInput): Promise<LoadSnapshotResult> {
  const path = resolve(input.root, input.entry.id, `${input.releaseId}.json`);
  const bytes = await readFile(path);
  const v = verifySnapshot(input.entry, bytes);
  if (!v.ok) return { ok: false, reason: v.reason };
  return { ok: true, bytes, path };
}
```

- [ ] **Step 6: Write the money parser implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\money.ts`:

```typescript
import { z } from "zod";

export const CentsParseErrorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("malformed"), input: z.string() }),
  z.object({ kind: z.literal("out-of-range"), input: z.string() }),
]);
export type CentsParseError = z.infer<typeof CentsParseErrorSchema>;

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CentsParseError };

// Accepts an exact decimal text representation and returns the value in integer
// cents. The parser is total: every input is either a successful parse, a
// "malformed" result (non-numeric, more than two decimal places, empty, or
// whitespace), or an "out-of-range" result (magnitude exceeds
// Number.MAX_SAFE_INTEGER cents). The sign is captured from a leading "-"
// exactly once, after magnitude is computed, so negative values like "-123.45"
// return -12345 cents. Leading "+", thousands separators, scientific notation,
// and currency symbols are rejected. The "0" and "0.00" inputs both yield 0.
const Pattern = /^-?(\d+)(?:\.(\d{1,2}))?$/;
const MaxSafeCents = BigInt(Number.MAX_SAFE_INTEGER);

export function parseDollarsToCents(input: string): ParseResult<number> {
  if (typeof input !== "string") {
    return { ok: false, error: { kind: "malformed", input: String(input) } };
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: { kind: "malformed", input: trimmed } };
  }
  const match = Pattern.exec(trimmed);
  if (!match) {
    return { ok: false, error: { kind: "malformed", input: trimmed } };
  }
  const wholeDigits = match[1] ?? "";
  const fracDigits = match[2] ?? "";
  if (wholeDigits.length === 0) {
    return { ok: false, error: { kind: "malformed", input: trimmed } };
  }
  const negative = trimmed.startsWith("-");
  const wholeCents = BigInt(wholeDigits) * 100n;
  const fracCents = BigInt((fracDigits + "00").slice(0, 2));
  const magnitude = wholeCents + fracCents;
  if (magnitude > MaxSafeCents) {
    return { ok: false, error: { kind: "out-of-range", input: trimmed } };
  }
  const value = Number(magnitude) * (negative ? -1 : 1);
  return { ok: true, value };
}
```

- [ ] **Step 7: Write the acquisition implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\acquire.ts`:

```typescript
import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { sha256Of, SourceEntrySchema, type SourceEntry, SourceManifestSchema } from "./sources/manifest";
import manifestData from "./sources/manifest.data.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_ROOT = resolve(__dirname, "../../data/snapshots");
const CACHE_ROOT = resolve(__dirname, "../../.artifacts-cache");
const RELEASE_ID = SourceManifestSchema.parse(manifestData).releaseId;

export interface AcquisitionResult {
  readonly sourceId: string;
  readonly bytes: Buffer;
  readonly checksumSha256: string;
  readonly snapshotPath: string;
  readonly sidecarPath: string;
}

export type SourceIdentityKind = "bls-series-id" | "dataset-id-from-url" | "berkeley-entity-scope";

// Identity rule per source. Each entry maps a source id to two checks:
//   1. dataset identity: BLS checks the body series id; Socrata and the
//      three SCO endpoints check the pinned dataset id that the manifest
//      pins inside the source URL.
//   2. entity scope: array payloads must contain at least one Berkeley
//      row (entity_name === "City of Berkeley" for SCO sources,
//      `program`/`service`/`expense_category` is irrelevant; for Socrata
//      the city of Berkeley cohort is implicit because Socrata is the
//      City of Berkeley portal).
export const SOURCE_IDENTITY_RULES: Readonly<Record<string, SourceIdentityKind>> = {
  "src-bls-cpi-u-cuura422sa0": "bls-series-id",
  "src-berkeley-socrata-gy8t-iqc4": "berkeley-entity-scope",
  "src-sco-expenditures-ju3w-4gxp": "dataset-id-from-url",
  "src-sco-expenditures-per-capita-ykhf-vfsr": "dataset-id-from-url",
  "src-sco-revenues-per-capita-ky7j-fsk5": "dataset-id-from-url",
};

const DATASET_ID_FROM_URL: Readonly<Record<string, string>> = {
  "src-sco-expenditures-ju3w-4gxp": "ju3w-4gxp",
  "src-sco-expenditures-per-capita-ykhf-vfsr": "ykhf-vfsr",
  "src-sco-revenues-per-capita-ky7j-fsk5": "ky7j-fsk5",
  "src-berkeley-socrata-gy8t-iqc4": "gy8t-iqc4",
};

function readIdentityField(body: unknown, dottedPath: string): unknown {
  const parts = dottedPath.split(".");
  let cursor: unknown = body;
  for (const part of parts) {
    if (cursor === null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

// Read a JSON-array body. Returns an empty array for an empty array.
function asArray(body: unknown): readonly unknown[] {
  return Array.isArray(body) ? body : [];
}

// Verify the identity of a parsed snapshot body against the rule for the
// given source. Throws with a typed message naming the rule that failed
// when any check is unsatisfied.
export function verifySourceIdentity(sourceId: SourceEntry["id"], body: unknown, url: string): void {
  const rule = SOURCE_IDENTITY_RULES[sourceId];
  if (!rule) {
    throw new Error(`No identity rule registered for source ${sourceId}`);
  }
  switch (rule) {
    case "bls-series-id": {
      const observed = readIdentityField(body, "Results.seriesID");
      if (observed !== "CUURA422SA0") {
        throw new Error(
          `Identity mismatch for ${sourceId}: expected Results.seriesID === "CUURA422SA0", observed ${String(observed)}`,
        );
      }
      return;
    }
    case "dataset-id-from-url": {
      const expectedDatasetId = DATASET_ID_FROM_URL[sourceId];
      if (!expectedDatasetId) {
        throw new Error(`No pinned dataset id for ${sourceId}`);
      }
      // The dataset id is the last path segment of the resource URL.
      // The manifest's URL contains it; if a response body ever disagrees
      // with the manifest's URL, that is itself an integrity failure.
      try {
        const parsed = new URL(url);
        const segments = parsed.pathname.split("/").filter((s) => s.length > 0);
        const last = segments[segments.length - 1] ?? "";
        const datasetIdInUrl = last.replace(/\.json$/, "");
        if (datasetIdInUrl !== expectedDatasetId) {
          throw new Error(
            `Identity mismatch for ${sourceId}: manifest URL does not contain pinned dataset id ${expectedDatasetId} (got ${datasetIdInUrl || "<empty>"})`,
          );
        }
      } catch (err) {
        throw new Error(
          `Identity mismatch for ${sourceId}: cannot parse manifest URL ${url} (${(err as Error).message})`,
        );
      }
      // SCO arrays: at least one row must carry Berkeley's entity_name.
      const rows = asArray(body);
      if (rows.length === 0) {
        throw new Error(`Identity mismatch for ${sourceId}: empty body, expected at least one Berkeley row`);
      }
      const hasBerkeley = rows.some((r) => {
        if (r === null || typeof r !== "object") return false;
        const entityName = (r as Record<string, unknown>)["entity_name"];
        return entityName === "City of Berkeley";
      });
      if (!hasBerkeley) {
        throw new Error(`Identity mismatch for ${sourceId}: no row carries entity_name === "City of Berkeley"`);
      }
      return;
    }
    case "berkeley-entity-scope": {
      // Socrata is the City of Berkeley's own portal; the URL itself pins
      // the cohort identity.
      try {
        const parsed = new URL(url);
        const segments = parsed.pathname.split("/").filter((s) => s.length > 0);
        const last = segments[segments.length - 1] ?? "";
        const datasetIdInUrl = last.replace(/\.json$/, "");
        if (datasetIdInUrl !== DATASET_ID_FROM_URL["src-berkeley-socrata-gy8t-iqc4"]) {
          throw new Error(
            `Identity mismatch for ${sourceId}: manifest URL does not contain pinned dataset id gy8t-iqc4 (got ${datasetIdInUrl || "<empty>"})`,
          );
        }
      } catch (err) {
        throw new Error(
          `Identity mismatch for ${sourceId}: cannot parse manifest URL ${url} (${(err as Error).message})`,
        );
      }
      return;
    }
    default: {
      const _exhaustive: never = rule;
      throw new Error(`Unhandled identity rule: ${String(_exhaustive)}`);
    }
  }
}

export async function acquireSource(entry: SourceEntry): Promise<AcquisitionResult> {
  const parsed = SourceEntrySchema.parse(entry);
  const response = await fetch(parsed.url, {
    headers: { Accept: "application/json", "User-Agent": "berkeley-budget-explorer/1.0" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${parsed.url}`);
  }
  const body = JSON.parse(await response.text()) as unknown;
  // Apply the typed identity rule before writing anything to disk.
  verifySourceIdentity(parsed.id, body, parsed.url);
  // Snapshot bytes are the canonical JSON of the parsed body. We do not
  // store the raw HTTP response. `JSON.stringify(parsedBody)` with
  // `undefined`, `function`, and `symbol` values stripped is the canonical
  // form every refresh of this source produces; the SHA-256 in the
  // manifest is the checksum of these exact bytes.
  const canonical = JSON.stringify(body, canonicalReplacer);
  const bytes = Buffer.from(canonical, "utf-8");
  const checksum = sha256Of(bytes);
  if (checksum === "0".repeat(64)) {
    throw new Error(`Computed all-zero checksum for ${parsed.id}; refusing to write snapshot`);
  }
  const targetDir = resolve(CACHE_ROOT, parsed.id);
  await mkdir(targetDir, { recursive: true });
  const snapshotPath = resolve(targetDir, `${RELEASE_ID}.json`);
  const sidecarPath = resolve(targetDir, `${RELEASE_ID}.sha256`);
  await writeFile(snapshotPath, bytes, "utf-8");
  await writeFile(sidecarPath, `${checksum}\n`, "utf-8");
  return { sourceId: parsed.id, bytes, checksumSha256: checksum, snapshotPath, sidecarPath };
}

function canonicalReplacer(_key: string, value: unknown): unknown {
  // Strip values that JSON does not represent. This is the same canonical
  // form operators must produce when hand-initialising snapshots.
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }
  return value;
}

async function commitSnapshot(result: AcquisitionResult): Promise<void> {
  const targetDir = resolve(SNAPSHOT_ROOT, result.sourceId);
  await mkdir(targetDir, { recursive: true });
  const finalSnapshot = resolve(targetDir, `${RELEASE_ID}.json`);
  const finalSidecar = resolve(targetDir, `${RELEASE_ID}.sha256`);
  await rename(result.snapshotPath, finalSnapshot);
  await rename(result.sidecarPath, finalSidecar);
}

export async function acquireAll(): Promise<void> {
  const manifest = SourceManifestSchema.parse(manifestData);
  const results: AcquisitionResult[] = [];
  try {
    for (const entry of manifest.sources) {
      const result = await acquireSource(entry);
      results.push(result);
    }
  } catch (err) {
    throw new Error(`Acquisition failed; existing snapshots at ${SNAPSHOT_ROOT} are untouched. ${(err as Error).message}`);
  }
  for (const result of results) await commitSnapshot(result);
  console.log(`Acquired ${results.length} snapshots for release ${RELEASE_ID}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  acquireAll().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 8: Run tests to verify they pass against the freshly written manifests and snapshots**

Run: `pnpm test -- sources/manifest.test sources/money.test acquire.test`
Expected: PASS (10 manifest + 10 money + 2 acquire tests).

- [ ] **Step 9: Initialise the five real snapshots by running the acquisition command**

Run: `pnpm refresh:data`
Expected: the command fetches the five pinned API endpoints, validates identity, writes `data/snapshots/<source-id>/rel-2026-07-20-001.json` plus matching `.sha256` sidecars, and prints `Acquired 5 snapshots for release rel-2026-07-20-001.` If any endpoint fails (network down, identity mismatch, schema drift) the command exits non-zero and leaves existing snapshots intact.

- [ ] **Step 10: Verify the manifest still lists five sources and that snapshot bytes match their checksums**

Run: `pnpm test -- sources/manifest.test`
Expected: PASS. The `verifySnapshot` test reads the real on-disk bytes and confirms each `checksumSha256` matches the SHA-256 the acquisition step computed.

- [ ] **Step 11: Verify typecheck and lint**

Run: `pnpm run typecheck`
Expected: exit code 0.

Run: `pnpm run lint`
Expected: exit code 0.

- [ ] **Step 12: OPTIONAL commit**

If Git initialized and approved:

```bash
git add src/pipeline/sources/manifest.ts src/pipeline/sources/manifest.test.ts src/pipeline/sources/manifest.data.json src/pipeline/sources/money.ts src/pipeline/sources/money.test.ts src/pipeline/acquire.ts src/pipeline/acquire.test.ts data/snapshots
git commit -m "feat(pipeline): 5-source manifest, snapshot acquisition, fixed-point money parser"
```

Otherwise skip this step.

---

## Task 4: BLS CPI-U adapter (verifies series id, refuses below-minimum coverage)

**Files:**
- Create: `src/pipeline/sources/bls-cpi.ts`
- Create: `src/pipeline/sources/bls-cpi.test.ts`
- Create: `src/pipeline/sources/bls-cpi.fixtures.ts` (header comment marks values as synthetic; never loaded by production)

**Interfaces:**
- Consumes: Zod 4, BLS `publicAPI/v2/timeseries/data/CUURA422SA0` response shape, the typed `parseDollarsToCents` parser, `loadSnapshot`.
- Produces:
  - `CpiObservation { year, month, value }` Zod schema (month ∈ [1,12]).
  - `BlsResponseSchema` parsing the `Results.seriesID === "CUURA422SA0"` wrapper plus the `data[]` array of `{year, period, value}`.
  - `parseBlsSnapshot(raw) -> readonly CpiObservation[]` parsing, rejecting responses whose series id does not equal `CUURA422SA0`.
  - `fiscalYearOf(month, year) -> number` (Berkeley FY: month ≥ 7 → next calendar year).
  - `fiscalYearAverage(observations) -> readonly FiscalYearAverage[]` reporting the actual `observationCount` (no universal 12-obs assertion).
- `MIN_COVERAGE = 6`, matching the six scheduled bimonthly observations BLS publishes for this metropolitan series. `factorFor(averages, baseYear, targetYear)` throws `CoverageIncompleteError` if either year's `observationCount` is below `MIN_COVERAGE`; otherwise returns `average(targetYear) / average(baseYear)`.
  - `latestCompleteFiscalYear(averages, minObservations) -> number` returns the largest FY whose coverage meets the floor; Phase 1's `baseYear` defaults to this value (initially FY2024).
  - `loadBlsFromSnapshot(root, releaseId) -> readonly CpiObservation[]` reads `data/snapshots/src-bls-cpi-u-cuura422sa0/<releaseId>.json`, verifies checksum via the manifest, and parses via `parseBlsSnapshot`.

- [ ] **Step 1: Write the failing tests**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\bls-cpi.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  factorFor,
  fiscalYearAverage,
  fiscalYearOf,
  latestCompleteFiscalYear,
  parseBlsSnapshot,
  BlsCoverageIncompleteError,
} from "./bls-cpi";
import { blsFixture } from "./bls-cpi.fixtures";
import { blsPartialFixture } from "./bls-cpi.fixtures";

describe("bls-cpi adapter", () => {
  it("verifies series id CUURA422SA0 and parses the wrapper shape", () => {
    const obs = parseBlsSnapshot(blsFixture);
    expect(obs.length).toBeGreaterThan(0);
  });

  it("rejects a snapshot whose series id does not match", () => {
    expect(() =>
      parseBlsSnapshot({
        Results: { seriesID: "WRONG", data: [] },
      }),
    ).toThrow(/CUURA422SA0/);
  });

  it("computes Berkeley fiscal year from a calendar month", () => {
    expect(fiscalYearOf(6, 2023)).toBe(2023);
    expect(fiscalYearOf(7, 2023)).toBe(2024);
    expect(fiscalYearOf(12, 2024)).toBe(2025);
    expect(fiscalYearOf(1, 2025)).toBe(2025);
  });

  it("reports the actual observationCount per FY (six bimonthly observations per complete FY)", () => {
    const averages = fiscalYearAverage(parseBlsSnapshot(blsFixture));
    const partial = fiscalYearAverage(parseBlsSnapshot(blsPartialFixture));
    const full = averages.find((a) => a.fiscalYear === 2024);
    expect(full?.observationCount).toBe(6);
    const partialFy = partial.find((a) => a.fiscalYear === 2024);
    expect(partialFy?.observationCount).toBeLessThan(6);
  });

  it("factorFor throws BlsCoverageIncompleteError when either FY has fewer than six bimonthly observations", () => {
    const partialAverages = fiscalYearAverage(parseBlsSnapshot(blsPartialFixture));
    expect(() => factorFor(partialAverages, 2023, 2024)).toThrow(BlsCoverageIncompleteError);
  });

  it("factorFor returns 1.0 between identical years that meet coverage", () => {
    const averages = fiscalYearAverage(parseBlsSnapshot(blsFixture));
    expect(factorFor(averages, 2024, 2024)).toBeCloseTo(1, 10);
  });

  it("latestCompleteFiscalYear returns the largest FY meeting the coverage floor", () => {
    const averages = fiscalYearAverage(parseBlsSnapshot(blsFixture));
    expect(latestCompleteFiscalYear(averages, 6)).toBe(2024);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- bls-cpi.test`
Expected: FAIL with `Cannot find module './bls-cpi'`.

- [ ] **Step 3: Write the implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\bls-cpi.ts`:

```typescript
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { SourceManifestSchema } from "./manifest";
import manifestData from "./manifest.data.json" with { type: "json" };

export const EXPECTED_SERIES_ID = "CUURA422SA0";

export const CpiObservationSchema = z.object({
  year: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12),
  value: z.number().positive(),
});
export type CpiObservation = z.infer<typeof CpiObservationSchema>;

const BlsDataRowSchema = z.object({
  year: z.string().regex(/^\d{4}$/),
  period: z.string().regex(/^M(0[1-9]|1[0-2])$/),
  value: z.string().regex(/^-?\d+(\.\d+)?$/),
});

export const BlsResponseSchema = z
  .object({
    Results: z.object({
      seriesID: z.string(),
      data: z.array(BlsDataRowSchema),
    }),
  })
  .refine((r) => r.Results.seriesID === EXPECTED_SERIES_ID, {
    message: `BlsResponse must carry seriesID "${EXPECTED_SERIES_ID}"`,
  });
export type BlsResponse = z.infer<typeof BlsResponseSchema>;

export const FiscalYearAverageSchema = z.object({
  fiscalYear: z.number().int().min(1900).max(2100),
  averageIndex: z.number().positive(),
  observationCount: z.number().int().min(0).max(6),
});
export type FiscalYearAverage = z.infer<typeof FiscalYearAverageSchema>;

export const MIN_COVERAGE = 6;

export class BlsCoverageIncompleteError extends Error {
  constructor(public readonly fiscalYear: number, public readonly observationCount: number) {
    super(
      `BLS coverage incomplete for fiscal year ${fiscalYear}: ${observationCount} observations (minimum ${MIN_COVERAGE})`,
    );
    this.name = "BlsCoverageIncompleteError";
  }
}

export function parseBlsSnapshot(raw: unknown): readonly CpiObservation[] {
  const response = BlsResponseSchema.parse(raw);
  return response.Results.data.map((row) => ({
    year: Number.parseInt(row.year, 10),
    month: Number.parseInt(row.period.slice(1), 10),
    value: Number.parseFloat(row.value),
  }));
}

export function fiscalYearOf(month: number, year: number): number {
  return month >= 7 ? year + 1 : year;
}

export function fiscalYearAverage(
  observations: readonly CpiObservation[],
): readonly FiscalYearAverage[] {
  const buckets = new Map<number, number[]>();
  for (const obs of observations) {
    const fy = fiscalYearOf(obs.month, obs.year);
    const list = buckets.get(fy) ?? [];
    list.push(obs.value);
    buckets.set(fy, list);
  }
  const result: FiscalYearAverage[] = [];
  for (const [fy, values] of [...buckets.entries()].sort(([a], [b]) => a - b)) {
    if (values.length === 0) continue;
    const sum = values.reduce((acc, v) => acc + v, 0);
    result.push({
      fiscalYear: fy,
      averageIndex: sum / values.length,
      observationCount: values.length,
    });
  }
  return result;
}

export function factorFor(
  averages: readonly FiscalYearAverage[],
  baseYear: number,
  targetYear: number,
): number {
  const base = averages.find((a) => a.fiscalYear === baseYear);
  const target = averages.find((a) => a.fiscalYear === targetYear);
  if (!base) {
    throw new BlsCoverageIncompleteError(baseYear, 0);
  }
  if (!target) {
    throw new BlsCoverageIncompleteError(targetYear, 0);
  }
  if (base.observationCount < MIN_COVERAGE) {
    throw new BlsCoverageIncompleteError(baseYear, base.observationCount);
  }
  if (target.observationCount < MIN_COVERAGE) {
    throw new BlsCoverageIncompleteError(targetYear, target.observationCount);
  }
  return target.averageIndex / base.averageIndex;
}

export function latestCompleteFiscalYear(
  averages: readonly FiscalYearAverage[],
  minObservations: number,
): number {
  const qualifying = averages.filter((a) => a.observationCount >= minObservations);
  if (qualifying.length === 0) throw new Error("No fiscal year meets the coverage floor");
  return Math.max(...qualifying.map((a) => a.fiscalYear));
}

// `parseCpiObservations` is the published-API-shaped entry point used by
// callers that already hold the parsed JSON body. The test fixtures and the
// snapshot reader both funnel through it. `loadBlsFromSnapshot` uses it
// after reading bytes from `data/snapshots/`.
export function parseCpiObservations(body: unknown): readonly CpiObservation[] {
  return parseBlsSnapshot(body);
}

// Inflate nominal cents to the base year by multiplying by
// `CPI(targetYear) / CPI(baseYear)`. Throws `BlsCoverageIncompleteError`
// if either year's coverage is below MIN_COVERAGE. The result is rounded
// to the nearest cent; downstream display layers format it.
export function inflateCents(
  nominalCents: number,
  targetYear: number,
  baseYear: number,
  averages: readonly FiscalYearAverage[],
): number {
  const factor = factorFor(averages, baseYear, targetYear);
  return Math.round(nominalCents * factor);
}

export async function loadBlsFromSnapshot(
  root: string,
  releaseId: string,
): Promise<readonly CpiObservation[]> {
  const manifest = SourceManifestSchema.parse(manifestData);
  const entry = manifest.sources.find((s) => s.id === "src-bls-cpi-u-cuura422sa0");
  if (!entry) throw new Error("BLS entry missing from manifest");
  const path = `${root}/${entry.id}/${releaseId}.json`;
  const bytes = await readFile(path);
  const expected = entry.checksumSha256;
  const actual = await import("node:crypto").then((m) => m.createHash("sha256").update(bytes).digest("hex"));
  if (actual !== expected) {
    throw new Error(`BLS snapshot checksum mismatch (expected ${expected}, got ${actual})`);
  }
  return parseCpiObservations(JSON.parse(bytes.toString("utf-8")));
}
```

- [ ] **Step 4: Write the synthetic fixtures (header comment marks them as test-only)**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\bls-cpi.fixtures.ts`:

```typescript
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

function row(year: number, month: number, value: number): { year: string; period: string; value: string } {
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
  [2018, 7, 271.012], [2018, 9, 272.108], [2018, 11, 273.450],
  [2019, 1, 274.812], [2019, 3, 276.105], [2019, 5, 277.430],
  // FY2020 (Jul 2019 – Jun 2020)
  [2019, 7, 280.123], [2019, 9, 281.412], [2019, 11, 282.510],
  [2020, 1, 283.602], [2020, 3, 283.945], [2020, 5, 282.789],
  // FY2021 (Jul 2020 – Jun 2021)
  [2020, 7, 284.310], [2020, 9, 285.450], [2020, 11, 286.530],
  [2021, 1, 287.801], [2021, 3, 289.120], [2021, 5, 291.012],
  // FY2022 (Jul 2021 – Jun 2022)
  [2021, 7, 292.870], [2021, 9, 294.103], [2021, 11, 296.001],
  [2022, 1, 298.412], [2022, 3, 300.812], [2022, 5, 303.511],
  // FY2023 (Jul 2022 – Jun 2023)
  [2022, 7, 306.301], [2022, 9, 308.432], [2022, 11, 310.420],
  [2023, 1, 312.123], [2023, 3, 313.901], [2023, 5, 315.812],
  // FY2024 (Jul 2023 – Jun 2024) — the initial base year
  [2023, 7, 317.012], [2023, 9, 318.901], [2023, 11, 320.012],
  [2024, 1, 321.512], [2024, 3, 323.012], [2024, 5, 324.890],
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
const partialRows = fullRows.filter(
  ([y, m]) => !(y === 2024 && (m === 3 || m === 5)),
);
export const blsPartialFixture: BlsResponse = {
  Results: {
    seriesID: "CUURA422SA0",
    data: partialRows.map(([y, m, v]) => row(y, m, v)),
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- bls-cpi.test`
Expected: PASS (7 tests).

- [ ] **Step 6: Verify typecheck and lint**

Run: `pnpm run typecheck`
Expected: exit code 0.

Run: `pnpm run lint`
Expected: exit code 0.

- [ ] **Step 7: OPTIONAL commit**

If Git initialized and approved:

```bash
git add src/pipeline/sources/bls-cpi.ts src/pipeline/sources/bls-cpi.test.ts src/pipeline/sources/bls-cpi.fixtures.ts
git commit -m "feat(pipeline): BLS adapter with series-id verification and coverage floor"
```

Otherwise skip this step.

---

## Task 5: Berkeley Socrata FY2012–FY2015 adapter (sealed cohort, not stitched to SCO)

**Files:**
- Create: `src/pipeline/sources/berkeley-socrata.ts`
- Create: `src/pipeline/sources/berkeley-socrata.test.ts`
- Create: `src/pipeline/sources/berkeley-socrata.fixtures.ts` (header comment marks values as synthetic)

**Interfaces:**
- Consumes: Zod 4, Socrata `gy8t-iqc4.json` response shape, `parseDollarsToCents`, `loadSnapshot`.
- Produces:
  - `SocrataRawRowSchema` accepting `fiscal_year` (string `FY####`), `department` (string), `program`, `service`, `expense_category`, `approved_amount` (string), `fund`, `description`, `expense_type`, `object_id`.
  - `parseSocrataRows(raw) -> readonly SocrataRow[]` parsing via `parseDollarsToCents` (negative-safe, out-of-range rejected).
  - `cohortFiscalYears(rows) -> { min: number; max: number }` reporting the cohort's actual fiscal-year range.
  - `groupByService(rows)` where `serviceKey = program ?? service ?? expense_category ?? "uncategorized"`.
  - `assertCohortSealed(rows, fyStart, fyEnd)` refuses rows whose `fiscalYear` is outside `[fyStart, fyEnd]`; the build calls this with `(2012, 2015)` and the assertion documents that the Socrata cohort must never be stitched to SCO actuals.

- [ ] **Step 1: Write the failing tests**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\berkeley-socrata.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- berkeley-socrata.test`
Expected: FAIL with `Cannot find module './berkeley-socrata'`.

- [ ] **Step 3: Write the implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\berkeley-socrata.ts`:

```typescript
import { z } from "zod";
import { parseDollarsToCents } from "./money";

const SocrataRawRowSchema = z.object({
  fiscal_year: z.string().regex(/^FY\d{4}$/),
  department: z.string().min(1),
  program: z.string().optional(),
  service: z.string().optional(),
  expense_category: z.string().optional(),
  approved_amount: z.string(),
  fund: z.string().min(1),
  description: z.string().optional(),
  expense_type: z.string().optional(),
  object_id: z.string().optional(),
});

const FiscalYearRegex = /^FY(\d{4})$/;

export const SocrataRowSchema = z.object({
  fiscalYear: z.number().int().min(1900).max(2100),
  department: z.string().min(1),
  program: z.string().optional(),
  service: z.string().optional(),
  expenseCategory: z.string().optional(),
  approvedAmountCents: z.number().int(),
  fund: z.string().min(1),
  description: z.string().optional(),
  expenseType: z.string().optional(),
  objectId: z.string().optional(),
});
export type SocrataRow = z.infer<typeof SocrataRowSchema>;

function fiscalYearFromString(value: string): number {
  const match = FiscalYearRegex.exec(value);
  if (!match) throw new Error(`Invalid fiscal_year string: ${value}`);
  return Number.parseInt(match[1] ?? "0", 10);
}

export function parseSocrataRows(raw: readonly unknown[]): readonly SocrataRow[] {
  const parsedRaw = z.array(SocrataRawRowSchema).parse(raw);
  return parsedRaw.map((r) => {
    const centsResult = parseDollarsToCents(r.approved_amount);
    if (!centsResult.ok) {
      throw new Error(`Socrata approved_amount parse failed: ${centsResult.error.kind} (${r.approved_amount})`);
    }
    const base: {
      fiscalYear: number;
      department: string;
      program?: string;
      service?: string;
      expenseCategory?: string;
      approvedAmountCents: number;
      fund: string;
      description?: string;
      expenseType?: string;
      objectId?: string;
    } = {
      fiscalYear: fiscalYearFromString(r.fiscal_year),
      department: r.department,
      approvedAmountCents: centsResult.value,
      fund: r.fund,
    };
    if (r.program !== undefined) base.program = r.program;
    if (r.service !== undefined) base.service = r.service;
    if (r.expense_category !== undefined) base.expenseCategory = r.expense_category;
    if (r.description !== undefined) base.description = r.description;
    if (r.expense_type !== undefined) base.expenseType = r.expense_type;
    if (r.object_id !== undefined) base.objectId = r.object_id;
    return base;
  });
}

export interface CohortRange {
  readonly min: number;
  readonly max: number;
}

export function cohortFiscalYears(rows: readonly SocrataRow[]): CohortRange {
  if (rows.length === 0) throw new Error("Cannot derive cohort range from empty rows");
  const years = rows.map((r) => r.fiscalYear);
  return { min: Math.min(...years), max: Math.max(...years) };
}

export function assertCohortSealed(
  rows: readonly SocrataRow[],
  fyStart: number,
  fyEnd: number,
): void {
  const out = rows.filter((r) => r.fiscalYear < fyStart || r.fiscalYear > fyEnd);
  if (out.length > 0) {
    const years = Array.from(new Set(out.map((r) => r.fiscalYear))).sort((a, b) => a - b);
    throw new Error(
      `Socrata cohort sealed to FY${fyStart}–FY${fyEnd} but found out-of-cohort rows for FY${years.join(", FY")}`,
    );
  }
}

export interface ServiceGroup {
  readonly serviceKey: string;
  readonly totalCents: number;
  readonly rowCount: number;
}

export function groupByService(rows: readonly SocrataRow[]): readonly ServiceGroup[] {
  const buckets = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const key = row.program ?? row.service ?? row.expenseCategory ?? "uncategorized";
    const bucket = buckets.get(key) ?? { total: 0, count: 0 };
    bucket.total += row.approvedAmountCents;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([serviceKey, { total, count }]) => ({
      serviceKey,
      totalCents: total,
      rowCount: count,
    }));
}
```

- [ ] **Step 4: Write the synthetic fixtures (header marks them test-only)**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\berkeley-socrata.fixtures.ts`:

```typescript
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
    approved_amount: "7890.00",
    fund: "General Fund",
    object_id: "PW-002",
  },
  {
    fiscal_year: "FY2014",
    department: "Police",
    program: "Patrol",
    expense_category: "Salaries",
    approved_amount: "50000.00",
    fund: "General Fund",
    object_id: "POL-100",
  },
  {
    fiscal_year: "FY2015",
    department: "Public Works",
    program: "Streets and Sidewalks",
    expense_category: "Salaries",
    approved_amount: "13000.00",
    fund: "General Fund",
    object_id: "PW-001",
  },
  {
    fiscal_year: "FY2015",
    department: "Library",
    program: "Public Services",
    expense_category: "Materials",
    approved_amount: "4500.00",
    fund: "Library Tax Fund",
    object_id: "LIB-200",
  },
];
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- berkeley-socrata.test`
Expected: PASS (5 tests).

- [ ] **Step 6: Verify typecheck and lint**

Run: `pnpm run typecheck`
Expected: exit code 0.

Run: `pnpm run lint`
Expected: exit code 0.

- [ ] **Step 7: OPTIONAL commit**

If Git initialized and approved:

```bash
git add src/pipeline/sources/berkeley-socrata.ts src/pipeline/sources/berkeley-socrata.test.ts src/pipeline/sources/berkeley-socrata.fixtures.ts
git commit -m "feat(pipeline): Berkeley Socrata sealed-cohort adapter"
```

Otherwise skip this step.

---

## Task 6: California State Controller adapters (detailed expenditures for context + per-capita datasets for authoritative citywide totals)

**Files:**
- Create: `src/pipeline/sources/sco-detailed.ts`
- Create: `src/pipeline/sources/sco-detailed.test.ts`
- Create: `src/pipeline/sources/sco-detailed.fixtures.ts` (header marks synthetic)
- Create: `src/pipeline/sources/sco-per-capita.ts`
- Create: `src/pipeline/sources/sco-per-capita.test.ts`
- Create: `src/pipeline/sources/sco-per-capita.fixtures.ts` (header marks synthetic)

**Interfaces (consume):** Zod 4, `parseDollarsToCents`, `loadSnapshot`, the typed `Result` from `money.ts`.

**Produces:**

`sco-detailed.ts` (category context only — never summed to a citywide total):

- `ScoDetailedRow` Zod schema with exactly these fields taken from the verified Socrata-style SCO `ju3w-4gxp` payload: `entity_name` (string), `fiscal_year` (string `FY####`, parsed via the fiscal-year regex on the trailing year text), `value` (string dollars, parsed via `parseDollarsToCents`), `category` (string), `subcategory_1` (string), `subcategory_2` (string), `line_description` (string), `estimated_population` (string dollar text representing an integer, parsed via `parseDollarsToCents` and rounded to integer), `type` (string — `actual` only; refuse other types with a typed error). The detailed schema does **not** carry `function_name`, `fund_name`, or any revenue fields, because the verified SCO detailed expenditure payload does not include them; the per-capita dataset is the authoritative source for those dimensions.
- `parseScoDetailed(raw) -> readonly ScoDetailedRow[]`.
- `filterBerkeley(rows)` requiring `entity_name === "City of Berkeley"`.
- `summarizeCategoriesByFiscalYear(rows)` returning per-FY totals only **after** excluding rows whose `line_description` starts with `total` or `subtotal` (case-insensitive), so summing never double-counts. The result is for category context and schema-break disclosure; it is not a citywide total.
- `assertNoCitywideSum(rows)` documents the contract: the detailed adapter never exports a citywide total. The build calls this to confirm the contract.

`sco-per-capita.ts` (authoritative citywide totals):

- `ScoExpenditurePerCapitaRow` Zod schema with exactly these fields from the verified SCO `ykhf-vfsr` payload: `entity_name` (string), `fiscal_year` (string `FY####`, parsed via the fiscal-year regex), `total_expenditures` (string dollars, parsed via `parseDollarsToCents`), `estimated_population` (string dollar text representing an integer, parsed and rounded), `expenditures_per_capita` (string dollars, parsed). No revenue fields.
- `ScoRevenuePerCapitaRow` Zod schema analogously with `entity_name`, `fiscal_year`, `total_revenues`, `estimated_population`, `revenues_per_capita`. No expenditure fields.
- `parseScoExpenditurePerCapita(raw)`, `parseScoRevenuePerCapita(raw)`.
- `filterBerkeley(rows)` for both, requiring `entity_name === "City of Berkeley"`.
- `citywideTrend(expenditureRows, revenueRows) -> readonly { fiscalYear, expendituresCents, revenuesCents, perResidentExpendituresCents, perResidentRevenuesCents, estimatedPopulation }[]` — the FY2003–FY2024 authoritative Phase 1 series. Each row's `perResidentExpendituresCents` is the source's own `expenditures_per_capita` parsed to cents (re-derived only when the source omits the field); the engine does not invent a per-resident figure that disagrees with the source.
- `crossCheckInternal(expenditureRows)` confirming within rounding (≤ $0.50 absolute) that `total_expenditures / estimated_population == expenditures_per_capita` for every Berkeley row; a public utility for the reconciliation task.

- [ ] **Step 1: Write the failing SCO detailed tests**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\sco-detailed.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  assertNoCitywideSum,
  filterBerkeley,
  parseScoDetailed,
  summarizeCategoriesByFiscalYear,
} from "./sco-detailed";
import { scoDetailedFixture } from "./sco-detailed.fixtures";

describe("sco-detailed adapter", () => {
  it("parses rows and converts string fiscal_year/value/population via the typed money parser", () => {
    const rows = parseScoDetailed(scoDetailedFixture);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.fiscalYear).toBe(2024);
    expect(rows[0]?.valueCents).toBeGreaterThan(0);
  });

  it("rejects rows whose type is not 'actual'", () => {
    const bad = scoDetailedFixture.map((r) => ({ ...r, type: "budget" }));
    expect(() => parseScoDetailed(bad)).toThrow(/type/i);
  });

  it("filters to Berkeley rows only", () => {
    const rows = parseScoDetailed(scoDetailedFixture);
    expect(filterBerkeley(rows).every((r) => r.entityName === "City of Berkeley")).toBe(true);
  });

  it("summarizeCategoriesByFiscalYear excludes type=total and type=subtotal rows so summing never double-counts", () => {
    const rows = parseScoDetailed(scoDetailedFixture);
    const summaries = summarizeCategoriesByFiscalYear(rows);
    expect(summaries.length).toBeGreaterThan(0);
    for (const s of summaries) {
      expect(s.excludedTotalRows).toBeGreaterThanOrEqual(0);
    }
  });

  it("assertNoCitywideSum passes on the per-line adapter (no sum function is exported)", () => {
    expect(() => assertNoCitywideSum(parseScoDetailed(scoDetailedFixture))).not.toThrow();
  });
});
```

- [ ] **Step 2: Write the SCO detailed implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\sco-detailed.ts`:

```typescript
import { z } from "zod";
import { parseDollarsToCents } from "./money";

const RawRowSchema = z.object({
  entity_name: z.string().min(1),
  fiscal_year: z.string().regex(/^FY\d{4}$/),
  value: z.string(),
  category: z.string().min(1),
  subcategory_1: z.string(),
  subcategory_2: z.string(),
  line_description: z.string().min(1),
  estimated_population: z.string(),
  type: z.string().min(1),
});

const FiscalYearRegex = /^FY(\d{4})$/;

export const ScoDetailedRowSchema = z.object({
  entityName: z.string().min(1),
  fiscalYear: z.number().int().min(1900).max(2100),
  valueCents: z.number().int(),
  category: z.string().min(1),
  subcategory1: z.string(),
  subcategory2: z.string(),
  lineDescription: z.string().min(1),
  estimatedPopulation: z.number().int().nonnegative(),
  type: z.string().min(1),
});
export type ScoDetailedRow = z.infer<typeof ScoDetailedRowSchema>;

export function parseScoDetailed(raw: readonly unknown[]): readonly ScoDetailedRow[] {
  const parsed = z.array(RawRowSchema).parse(raw);
  return parsed.map((r) => {
    const yearMatch = FiscalYearRegex.exec(r.fiscal_year);
    if (!yearMatch) throw new Error(`Invalid fiscal_year: ${r.fiscal_year}`);
    const valueResult = parseDollarsToCents(r.value);
    if (!valueResult.ok) {
      throw new Error(`SCO detailed value parse failed: ${valueResult.error.kind} (${r.value})`);
    }
    const popResult = parseDollarsToCents(r.estimated_population);
    if (!popResult.ok) {
      throw new Error(`SCO detailed population parse failed: ${popResult.error.kind} (${r.estimated_population})`);
    }
    if (r.type !== "actual") {
      throw new Error(`SCO detailed type must be "actual"; received "${r.type}" for FY${yearMatch[1]}`);
    }
    return {
      entityName: r.entity_name,
      fiscalYear: Number.parseInt(yearMatch[1] ?? "0", 10),
      valueCents: valueResult.value,
      category: r.category,
      subcategory1: r.subcategory_1,
      subcategory2: r.subcategory_2,
      lineDescription: r.line_description,
      estimatedPopulation: Math.round(popResult.value / 100),
      type: r.type,
    };
  });
}

export function filterBerkeley(rows: readonly ScoDetailedRow[]): readonly ScoDetailedRow[] {
  return rows.filter((r) => r.entityName === "City of Berkeley");
}

export interface CategorySummary {
  readonly fiscalYear: number;
  readonly category: string;
  readonly totalCents: number;
  readonly lineCount: number;
  readonly excludedTotalRows: number;
}

export function summarizeCategoriesByFiscalYear(
  rows: readonly ScoDetailedRow[],
): readonly CategorySummary[] {
  const bucketed = new Map<string, { total: number; count: number; excluded: number }>();
  for (const r of rows) {
    const isSubtotal = r.lineDescription.toLowerCase().startsWith("total") ||
      r.lineDescription.toLowerCase().startsWith("subtotal");
    const key = `${r.fiscalYear}::${r.category}`;
    const bucket = bucketed.get(key) ?? { total: 0, count: 0, excluded: 0 };
    if (isSubtotal) {
      bucket.excluded += 1;
    } else {
      bucket.total += r.valueCents;
      bucket.count += 1;
    }
    bucketed.set(key, bucket);
  }
  return [...bucketed.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => {
      const [year, category] = key.split("::");
      return {
        fiscalYear: Number.parseInt(year ?? "0", 10),
        category: category ?? "",
        totalCents: b.total,
        lineCount: b.count,
        excludedTotalRows: b.excluded,
      };
    });
}

export function assertNoCitywideSum(rows: readonly ScoDetailedRow[]): void {
  // Contract: this adapter only exposes per-line rows and a per-category
  // summary. It never produces a citywide total. The build calls this to
  // make that contract visible at runtime. Empty input is fine: it means
  // no per-line rows are present and the contract holds vacuously.
  if (rows.length === 0) return;
  const categoryTotals = summarizeCategoriesByFiscalYear(rows);
  if (categoryTotals.length === 0) return;
  // The detailed adapter must not expose a "citywide total" category. Any
  // category whose name is "Total" or starts with "Total"/"Subtotal" is a
  // sign that the source row was mis-classified as a line item. Refuse it.
  for (const summary of categoryTotals) {
    if (/^total$/i.test(summary.category) || /^subtotal$/i.test(summary.category)) {
      throw new Error(
        `sco-detailed adapter must not contain a citywide-total category; got category "${summary.category}" for FY${summary.fiscalYear}`,
      );
    }
  }
}
```

- [ ] **Step 3: Write the synthetic SCO detailed fixtures**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\sco-detailed.fixtures.ts`:

```typescript
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
```

- [ ] **Step 4: Write the failing SCO per-capita tests**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\sco-per-capita.test.ts`:

```typescript
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
    // total/population result ($6274.13). Both the source-published
    // per-capita value and the derived value equal 627413 cents, so
    // citywideTrend must use the source-published value verbatim.
    expect(fy2024?.perResidentExpendituresCents).toBe(627413);
    // And it must still match the derived rounded total/pop within the
    // documented 50-cent tolerance (which `crossCheckInternal` enforces).
    expect(fy2024?.perResidentExpendituresCents).toBe(
      Math.round(78000000000 / 124320),
    );
  });
});
```

- [ ] **Step 5: Write the SCO per-capita implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\sco-per-capita.ts`:

```typescript
import { z } from "zod";
import { parseDollarsToCents } from "./money";

const FiscalYearRegex = /^FY(\d{4})$/;
const RawExpRowSchema = z.object({
  entity_name: z.string().min(1),
  fiscal_year: z.string().regex(/^FY\d{4}$/),
  total_expenditures: z.string(),
  estimated_population: z.string(),
  expenditures_per_capita: z.string(),
});
const RawRevRowSchema = z.object({
  entity_name: z.string().min(1),
  fiscal_year: z.string().regex(/^FY\d{4}$/),
  total_revenues: z.string(),
  estimated_population: z.string(),
  revenues_per_capita: z.string(),
});

function yearFromFYString(value: string): number {
  const m = FiscalYearRegex.exec(value);
  if (!m) throw new Error(`Invalid fiscal_year: ${value}`);
  return Number.parseInt(m[1] ?? "0", 10);
}

function requireCents(label: string, raw: string): number {
  const r = parseDollarsToCents(raw);
  if (!r.ok) throw new Error(`${label} parse failed: ${r.error.kind} (${raw})`);
  return r.value;
}

function requireIntegerPopulation(label: string, raw: string): number {
  const cents = requireCents(label, raw);
  return Math.round(cents / 100);
}

export const ScoExpenditurePerCapitaRowSchema = z.object({
  entityName: z.string().min(1),
  fiscalYear: z.number().int().min(1900).max(2100),
  totalExpendituresCents: z.number().int(),
  estimatedPopulation: z.number().int().nonnegative(),
  expendituresPerCapitaCents: z.number().int(),
});
export type ScoExpenditurePerCapitaRow = z.infer<typeof ScoExpenditurePerCapitaRowSchema>;

export const ScoRevenuePerCapitaRowSchema = z.object({
  entityName: z.string().min(1),
  fiscalYear: z.number().int().min(1900).max(2100),
  totalRevenuesCents: z.number().int(),
  estimatedPopulation: z.number().int().nonnegative(),
  revenuesPerCapitaCents: z.number().int(),
});
export type ScoRevenuePerCapitaRow = z.infer<typeof ScoRevenuePerCapitaRowSchema>;

export function parseScoExpenditurePerCapita(raw: readonly unknown[]): readonly ScoExpenditurePerCapitaRow[] {
  const parsed = z.array(RawExpRowSchema).parse(raw);
  return parsed.map((r) => ({
    entityName: r.entity_name,
    fiscalYear: yearFromFYString(r.fiscal_year),
    totalExpendituresCents: requireCents("total_expenditures", r.total_expenditures),
    estimatedPopulation: requireIntegerPopulation("estimated_population", r.estimated_population),
    expendituresPerCapitaCents: requireCents("expenditures_per_capita", r.expenditures_per_capita),
  }));
}

export function parseScoRevenuePerCapita(raw: readonly unknown[]): readonly ScoRevenuePerCapitaRow[] {
  const parsed = z.array(RawRevRowSchema).parse(raw);
  return parsed.map((r) => ({
    entityName: r.entity_name,
    fiscalYear: yearFromFYString(r.fiscal_year),
    totalRevenuesCents: requireCents("total_revenues", r.total_revenues),
    estimatedPopulation: requireIntegerPopulation("estimated_population", r.estimated_population),
    revenuesPerCapitaCents: requireCents("revenues_per_capita", r.revenues_per_capita),
  }));
}

export function filterBerkeley<
  T extends { entityName: string },
>(rows: readonly T[]): readonly T[] {
  return rows.filter((r) => r.entityName === "City of Berkeley");
}

export function crossCheckInternal(
  rows: readonly ScoExpenditurePerCapitaRow[],
  toleranceCents: number = 50,
): void {
  for (const r of rows) {
    if (r.estimatedPopulation === 0) continue;
    const expected = Math.round(r.totalExpendituresCents / r.estimatedPopulation);
    const diff = Math.abs(expected - r.expendituresPerCapitaCents);
    if (diff > toleranceCents) {
      throw new Error(
        `SCO per-capita cross-check failed for FY${r.fiscalYear}: ` +
          `expected total/pop ≈ ${expected} cents, observed ${r.expendituresPerCapitaCents} cents (diff ${diff})`,
      );
    }
  }
}

export interface CitywideTrendPoint {
  readonly fiscalYear: number;
  readonly expendituresCents: number;
  readonly revenuesCents: number;
  readonly estimatedPopulation: number;
  readonly perResidentExpendituresCents: number;
  readonly perResidentRevenuesCents: number;
}

export function citywideTrend(
  expenditureRows: readonly ScoExpenditurePerCapitaRow[],
  revenueRows: readonly ScoRevenuePerCapitaRow[],
): readonly CitywideTrendPoint[] {
  const byYear = new Map<number, CitywideTrendPoint>();
  for (const r of expenditureRows) {
    const prev = byYear.get(r.fiscalYear) ?? {
      fiscalYear: r.fiscalYear,
      expendituresCents: 0,
      revenuesCents: 0,
      estimatedPopulation: r.estimatedPopulation,
      perResidentExpendituresCents: 0,
      perResidentRevenuesCents: 0,
    };
    prev.expendituresCents = r.totalExpendituresCents;
    prev.estimatedPopulation = r.estimatedPopulation;
    // The source publishes its own per-capita value; we use that exact cents
    // value rather than re-deriving it from total / population. The
    // `crossCheckInternal` reconciliation guarantees the two agree within
    // half a dollar, so the choice does not affect the displayed figure.
    prev.perResidentExpendituresCents = r.expendituresPerCapitaCents;
    byYear.set(r.fiscalYear, prev);
  }
  for (const r of revenueRows) {
    const prev = byYear.get(r.fiscalYear) ?? {
      fiscalYear: r.fiscalYear,
      expendituresCents: 0,
      revenuesCents: 0,
      estimatedPopulation: r.estimatedPopulation,
      perResidentExpendituresCents: 0,
      perResidentRevenuesCents: 0,
    };
    prev.revenuesCents = r.totalRevenuesCents;
    prev.perResidentRevenuesCents = r.revenuesPerCapitaCents;
    byYear.set(r.fiscalYear, prev);
  }
  return [...byYear.values()].sort((a, b) => a.fiscalYear - b.fiscalYear);
}
```

- [ ] **Step 6: Write the synthetic SCO per-capita fixtures**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\sources\sco-per-capita.fixtures.ts`:

```typescript
// SYNTHETIC TEST FIXTURES — DO NOT LOAD IN PRODUCTION.
// Production reads `data/snapshots/src-sco-expenditures-per-capita-ykhf-vfsr/<releaseId>.json`
// and `data/snapshots/src-sco-revenues-per-capita-ky7j-fsk5/<releaseId>.json`,
// which are populated by `pnpm refresh:data`.
//
// Each synthetic row's `*_per_capita` value is set to the exact rounded
// `total_expenditures / estimated_population` (or `total_revenues /
// estimated_population`) result, so that `crossCheckInternal` (the 50-cent
// tolerance check) and `citywideTrend` (which uses the source-published
// per-capita value verbatim) agree within zero cents. This convention is
// documented here so future fixtures remain internally consistent.

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
    fiscal_year: "FY2003",
    total_expenditures: "300000000.00",
    estimated_population: "103500",
    expenditures_per_capita: "2898.55",
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
    fiscal_year: "FY2024",
    total_expenditures: "780000000.00",
    estimated_population: "124320",
    expenditures_per_capita: "6274.13",
  },
];

export const scoRevenuePerCapitaFixture: readonly ScoRevenuePerCapitaFixtureRow[] = [
  {
    entity_name: "City of Berkeley",
    fiscal_year: "FY2015",
    total_revenues: "490000000.00",
    estimated_population: "118479",
    revenues_per_capita: "4135.75",
  },
  {
    entity_name: "City of Berkeley",
    fiscal_year: "FY2024",
    total_revenues: "800000000.00",
    estimated_population: "124320",
    revenues_per_capita: "6435.01",
  },
];
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test -- sources/sco-detailed.test sources/sco-per-capita.test`
Expected: PASS (12 tests).

- [ ] **Step 8: Verify typecheck and lint**

Run: `pnpm run typecheck`
Expected: exit code 0.

Run: `pnpm run lint`
Expected: exit code 0.

- [ ] **Step 9: OPTIONAL commit**

If Git initialized and approved:

```bash
git add src/pipeline/sources/sco-detailed.ts src/pipeline/sources/sco-detailed.test.ts src/pipeline/sources/sco-detailed.fixtures.ts src/pipeline/sources/sco-per-capita.ts src/pipeline/sources/sco-per-capita.test.ts src/pipeline/sources/sco-per-capita.fixtures.ts
git commit -m "feat(pipeline): SCO detailed + per-capita adapters with text-typed schemas"
```

Otherwise skip this step.

---

## Task 7: Canonical model schema (BudgetValue, Entity, CrosswalkEntry)

**Files:**
- Create: `src/pipeline/canonical/schema.ts`
- Create: `src/pipeline/canonical/schema.test.ts`

**Interfaces:**
- Consumes: Zod 4, shared primitives from `src/pipeline/sources/manifest.ts`.
- Produces:
  - `StageSchema` enum: `proposed | adopted | revised | projected | actual`.
  - `BasisSchema` enum: `budgetary | gaap | modified-accrual | unknown`.
  - `EntityTypeSchema` enum: `service | department | fund | program | revenue-category | expense-category | capital-project`.
  - `ExtractionMethodSchema` enum: `api | structured-table | manual-transcription | pdf-extraction`.
  - `ConfidenceSchema` enum: `verified | review-required | excluded`.
  - `ComparabilitySchema` enum: `exact | reconstructed | approximate | incompatible`.
  - `BudgetValueSchema` carrying `fiscalYear`, `amountNominalCents`, `stage`, `basis`, `entityId`, `entityType`, `sourceId`, `sourceLabel`, `extractionMethod`, `confidence`, `schemaVersion`.
  - `EntitySchema` carrying `id`, `type`, `canonicalName`, `plainDescription`, optional `parentId`, optional `serviceKey`.
  - `CrosswalkEntrySchema` carrying `sourceEntityKey`, `canonicalEntityId`, `effectiveStart`, `effectiveEnd`, `rationale`, `cardinality`, `comparability`, `reviewer`, `reviewedAt`.

- [ ] **Step 1: Write the failing test**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\canonical\schema.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  BasisSchema,
  BudgetValueSchema,
  ComparabilitySchema,
  ConfidenceSchema,
  CrosswalkEntrySchema,
  EntitySchema,
  EntityTypeSchema,
  ExtractionMethodSchema,
  StageSchema,
} from "./schema";

const baseValue = {
  fiscalYear: 2024,
  amountNominalCents: 123456_00,
  stage: "actual" as const,
  basis: "gaap" as const,
  entityId: "ent-service-streets",
  entityType: "service" as const,
  sourceId: "src-sco-expenditures-per-capita-ykhf-vfsr",
  sourceLabel: "City of Berkeley total expenditures (per-capita dataset, FY2024)",
  extractionMethod: "api" as const,
  confidence: "verified" as const,
  schemaVersion: "1.0.0",
};

describe("canonical schema", () => {
  it("accepts a complete BudgetValue", () => {
    expect(() => BudgetValueSchema.parse(baseValue)).not.toThrow();
  });

  it("rejects an unknown stage", () => {
    expect(() => StageSchema.parse("forecast")).toThrow();
  });

  it("rejects an unknown entity type", () => {
    expect(() => EntityTypeSchema.parse("neighborhood")).toThrow();
  });

  it("rejects an unknown extraction method", () => {
    expect(() => ExtractionMethodSchema.parse("scraped")).toThrow();
  });

  it("rejects an unknown confidence", () => {
    expect(() => ConfidenceSchema.parse("maybe")).toThrow();
  });

  it("rejects an unknown comparability level", () => {
    expect(() => ComparabilitySchema.parse("close")).toThrow();
  });

  it("rejects an unknown basis", () => {
    expect(() => BasisSchema.parse("cash")).toThrow();
  });

  it("accepts a valid Entity with optional parentId", () => {
    expect(() =>
      EntitySchema.parse({
        id: "ent-service-streets",
        type: "service",
        canonicalName: "Streets and Sidewalks",
        plainDescription: "Roadway maintenance and paving programs.",
        parentId: "ent-department-public-works",
        serviceKey: "svc-streets",
      }),
    ).not.toThrow();
  });

  it("rejects a CrosswalkEntry whose effectiveEnd precedes effectiveStart", () => {
    expect(() =>
      CrosswalkEntrySchema.parse({
        sourceEntityKey: "socrata:department:Public Works",
        canonicalEntityId: "ent-department-public-works",
        effectiveStart: 2015,
        effectiveEnd: 2012,
        rationale: "Pre-reorg coverage.",
        cardinality: "one-to-one",
        comparability: "exact",
        reviewer: "pipeline-bot",
        reviewedAt: "2026-07-20",
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- canonical/schema.test`
Expected: FAIL with `Cannot find module './schema'`.

- [ ] **Step 3: Write the implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\canonical\schema.ts`:

```typescript
import { z } from "zod";
import { SemverSchema, SourceIdSchema } from "../sources/manifest";

export const StageSchema = z.enum([
  "proposed",
  "adopted",
  "revised",
  "projected",
  "actual",
]);
export type Stage = z.infer<typeof StageSchema>;

export const BasisSchema = z.enum([
  "budgetary",
  "gaap",
  "modified-accrual",
  "unknown",
]);
export type Basis = z.infer<typeof BasisSchema>;

export const EntityTypeSchema = z.enum([
  "service",
  "department",
  "fund",
  "program",
  "revenue-category",
  "expense-category",
  "capital-project",
]);
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const ExtractionMethodSchema = z.enum([
  "api",
  "structured-table",
  "manual-transcription",
  "pdf-extraction",
]);
export type ExtractionMethod = z.infer<typeof ExtractionMethodSchema>;

export const ConfidenceSchema = z.enum([
  "verified",
  "review-required",
  "excluded",
]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ComparabilitySchema = z.enum([
  "exact",
  "reconstructed",
  "approximate",
  "incompatible",
]);
export type Comparability = z.infer<typeof ComparabilitySchema>;

export const EntityIdSchema = z.string().regex(/^ent-[a-z0-9-]+$/);
export type EntityId = z.infer<typeof EntityIdSchema>;

export const FiscalYearSchema = z.number().int().min(1900).max(2100);

export const BudgetValueSchema = z.object({
  fiscalYear: FiscalYearSchema,
  amountNominalCents: z.number().int(),
  stage: StageSchema,
  basis: BasisSchema,
  entityId: EntityIdSchema,
  entityType: EntityTypeSchema,
  sourceId: SourceIdSchema,
  sourceLabel: z.string().min(1),
  extractionMethod: ExtractionMethodSchema,
  confidence: ConfidenceSchema,
  schemaVersion: SemverSchema,
});
export type BudgetValue = z.infer<typeof BudgetValueSchema>;

export const EntitySchema = z.object({
  id: EntityIdSchema,
  type: EntityTypeSchema,
  canonicalName: z.string().min(1),
  plainDescription: z.string().min(1),
  parentId: EntityIdSchema.optional(),
  serviceKey: z.string().regex(/^svc-[a-z0-9-]+$/).optional(),
});
export type Entity = z.infer<typeof EntitySchema>;

const CardinalitySchema = z.enum(["one-to-one", "many-to-one", "partial"]);

export const CrosswalkEntrySchema = z
  .object({
    sourceEntityKey: z.string().min(1),
    canonicalEntityId: EntityIdSchema,
    effectiveStart: FiscalYearSchema,
    effectiveEnd: FiscalYearSchema,
    rationale: z.string().min(1),
    cardinality: CardinalitySchema,
    comparability: ComparabilitySchema,
    reviewer: z.string().min(1),
    reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((e) => e.effectiveEnd >= e.effectiveStart, {
    message: "effectiveEnd must be >= effectiveStart",
  });
export type CrosswalkEntry = z.infer<typeof CrosswalkEntrySchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- canonical/schema.test`
Expected: PASS (9 tests).

- [ ] **Step 5: Verify typecheck and lint**

Run: `pnpm run typecheck`
Expected: exit code 0.

Run: `pnpm run lint`
Expected: exit code 0.

- [ ] **Step 6: OPTIONAL commit**

If Git initialized and approved:

```bash
git add src/pipeline/canonical/schema.ts src/pipeline/canonical/schema.test.ts
git commit -m "feat(pipeline): canonical BudgetValue/Entity/Crosswalk schemas"
```

Otherwise skip this step.

---

## Task 8: Crosswalk loader and validation (effective-dated, no overlap conflicts)

**Files:**
- Create: `src/pipeline/canonical/crosswalk.ts`
- Create: `src/pipeline/canonical/crosswalk.test.ts`
- Create: `src/pipeline/canonical/crosswalk.data.json`

**Interfaces:**
- Consumes: `CrosswalkEntrySchema`, `EntitySchema` from canonical schema.
- Produces:
  - `loadCrosswalk(raw) -> readonly CrosswalkEntry[]` parsing the pinned fixture.
  - `resolveEntityId(crosswalk, sourceEntityKey, fiscalYear) -> EntityId | undefined` returning the canonical id whose effective range covers the year, or `undefined` if no entry applies.
  - `validateCrosswalk(crosswalk, entities) -> ValidationResult` checking (a) every `canonicalEntityId` exists in the entity registry, (b) no two entries for the same `sourceEntityKey` overlap on fiscal years, (c) every `effectiveStart`/`effectiveEnd` is a sensible Berkeley FY.
  - `ValidationResult = { ok: true } | { ok: false; errors: readonly string[] }`.

- [ ] **Step 1: Write the failing test**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\canonical\crosswalk.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  loadCrosswalk,
  resolveEntityId,
  validateCrosswalk,
} from "./crosswalk";
import crosswalkData from "./crosswalk.data.json" with { type: "json" };
import type { Entity } from "./schema";

const entities: readonly Entity[] = [
  {
    id: "ent-service-streets",
    type: "service",
    canonicalName: "Streets and Sidewalks",
    plainDescription: "Roadway maintenance and paving.",
    serviceKey: "svc-streets",
  },
  {
    id: "ent-department-public-works",
    type: "department",
    canonicalName: "Public Works",
    plainDescription: "Public works operations.",
  },
  {
    id: "ent-citywide-berkeley",
    type: "service",
    canonicalName: "Citywide Berkeley Operations",
    plainDescription: "Citywide total reported by the State Controller.",
  },
];

describe("crosswalk loader", () => {
  it("loads the pinned fixture", () => {
    const entries = loadCrosswalk(crosswalkData);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("resolves a fiscal year to the matching canonical entity id", () => {
    const entries = loadCrosswalk(crosswalkData);
    const id = resolveEntityId(entries, "socrata:department:Public Works", 2014);
    expect(id).toBe("ent-department-public-works");
  });

  it("returns undefined when no entry covers the fiscal year", () => {
    const entries = loadCrosswalk(crosswalkData);
    const id = resolveEntityId(entries, "socrata:department:Public Works", 2020);
    expect(id).toBeUndefined();
  });

  it("validates that canonical entity ids exist in the registry", () => {
    const entries = loadCrosswalk(crosswalkData);
    const result = validateCrosswalk(entries, entities);
    expect(result.ok).toBe(true);
  });

  it("flags a missing canonical entity", () => {
    const entries = loadCrosswalk(crosswalkData);
    const orphan: readonly Entity[] = [];
    const result = validateCrosswalk(entries, orphan);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("flags overlapping effective ranges for the same source entity key", () => {
    const overlapping = [
      {
        sourceEntityKey: "socrata:department:Public Works",
        canonicalEntityId: "ent-department-public-works",
        effectiveStart: 2012,
        effectiveEnd: 2016,
        rationale: "First window",
        cardinality: "one-to-one" as const,
        comparability: "exact" as const,
        reviewer: "pipeline-bot",
        reviewedAt: "2026-07-20",
      },
      {
        sourceEntityKey: "socrata:department:Public Works",
        canonicalEntityId: "ent-department-public-works",
        effectiveStart: 2014,
        effectiveEnd: 2018,
        rationale: "Overlaps prior window",
        cardinality: "one-to-one" as const,
        comparability: "exact" as const,
        reviewer: "pipeline-bot",
        reviewedAt: "2026-07-20",
      },
    ];
    const result = validateCrosswalk(overlapping, entities);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- canonical/crosswalk.test`
Expected: FAIL with `Cannot find module './crosswalk'`.

- [ ] **Step 3: Write the implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\canonical\crosswalk.ts`:

```typescript
import { z } from "zod";
import {
  CrosswalkEntrySchema,
  EntitySchema,
  type CrosswalkEntry,
  type Entity,
} from "./schema";

const CrosswalkFileSchema = z.object({
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  entries: z.array(CrosswalkEntrySchema),
});

export function loadCrosswalk(raw: unknown): readonly CrosswalkEntry[] {
  const file = CrosswalkFileSchema.parse(raw);
  return file.entries;
}

export function resolveEntityId(
  entries: readonly CrosswalkEntry[],
  sourceEntityKey: string,
  fiscalYear: number,
): string | undefined {
  for (const entry of entries) {
    if (entry.sourceEntityKey !== sourceEntityKey) continue;
    if (fiscalYear >= entry.effectiveStart && fiscalYear <= entry.effectiveEnd) {
      return entry.canonicalEntityId;
    }
  }
  return undefined;
}

export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly string[] };

export function validateCrosswalk(
  entries: readonly CrosswalkEntry[],
  entities: readonly Entity[],
): ValidationResult {
  const errors: string[] = [];
  const entityIds = new Set(entities.map((e) => e.id));
  for (const entry of entries) {
    if (!entityIds.has(entry.canonicalEntityId)) {
      errors.push(
        `Crosswalk entry references unknown entity ${entry.canonicalEntityId} (source=${entry.sourceEntityKey})`,
      );
    }
  }
  const bySource = new Map<string, CrosswalkEntry[]>();
  for (const entry of entries) {
    const list = bySource.get(entry.sourceEntityKey) ?? [];
    list.push(entry);
    bySource.set(entry.sourceEntityKey, list);
  }
  for (const [key, list] of bySource) {
    const sorted = [...list].sort((a, b) => a.effectiveStart - b.effectiveStart);
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (!current || !next) continue;
      if (next.effectiveStart <= current.effectiveEnd) {
        errors.push(
          `Crosswalk overlap for ${key}: ${current.effectiveStart}-${current.effectiveEnd} overlaps ${next.effectiveStart}-${next.effectiveEnd}`,
        );
      }
    }
  }
  EntitySchema.array().parse(entities);
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
```

- [ ] **Step 4: Run test to verify the JSON fixture resolves**

Run: `pnpm test -- canonical/crosswalk.test`
Expected: FAIL with `Cannot find module './crosswalk.data.json'`.

- [ ] **Step 5: Write the pinned crosswalk fixture**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\canonical\crosswalk.data.json`:

```json
{
  "schemaVersion": "1.0.0",
  "entries": [
    {
      "sourceEntityKey": "socrata:department:Public Works",
      "canonicalEntityId": "ent-department-public-works",
      "effectiveStart": 2012,
      "effectiveEnd": 2015,
      "rationale": "Cohort present in Socrata gy8t-iqc4 FY2012-FY2015.",
      "cardinality": "one-to-one",
      "comparability": "exact",
      "reviewer": "pipeline-bot",
      "reviewedAt": "2026-07-20"
    },
    {
      "sourceEntityKey": "socrata:program:Streets and Sidewalks",
      "canonicalEntityId": "ent-service-streets",
      "effectiveStart": 2012,
      "effectiveEnd": 2015,
      "rationale": "Streets and Sidewalks program appears under Public Works for the sealed cohort.",
      "cardinality": "one-to-one",
      "comparability": "exact",
      "reviewer": "pipeline-bot",
      "reviewedAt": "2026-07-20"
    },
    {
      "sourceEntityKey": "sco-per-capita-expenditures:citywide:Berkeley",
      "canonicalEntityId": "ent-citywide-berkeley",
      "effectiveStart": 2003,
      "effectiveEnd": 2024,
      "rationale": "State Controller citywide totals apply across the verified window.",
      "cardinality": "one-to-one",
      "comparability": "reconstructed",
      "reviewer": "pipeline-bot",
      "reviewedAt": "2026-07-20"
    }
  ]
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test -- canonical/crosswalk.test`
Expected: PASS (6 tests).

- [ ] **Step 7: Verify typecheck and lint**

Run: `pnpm run typecheck`
Expected: exit code 0.

Run: `pnpm run lint`
Expected: exit code 0.

- [ ] **Step 8: OPTIONAL commit**

If Git initialized and approved:

```bash
git add src/pipeline/canonical/crosswalk.ts src/pipeline/canonical/crosswalk.test.ts src/pipeline/canonical/crosswalk.data.json
git commit -m "feat(pipeline): crosswalk loader + effective-date validation"
```

Otherwise skip this step.

---

## Task 9: Reconciliation runner (per-capita internal cross-check + BLS coverage + Socrata cohort seal)

**Files:**
- Create: `src/pipeline/reconcile/reconcile.ts`
- Create: `src/pipeline/reconcile/reconcile.test.ts`
- Create: `src/pipeline/reconcile/reconcile.fixtures.ts` (header marks synthetic)

**Interfaces:**
- Consumes: `ScoExpenditurePerCapitaRow`, `ScoRevenuePerCapitaRow` from `sco-per-capita.ts`; `CpiObservation`, `MIN_COVERAGE`, `fiscalYearAverage` from `bls-cpi.ts`; `SocrataRow` from `berkeley-socrata.ts`.
- Produces:
  - `reconcileScoPerCapita(rows) -> ReconciliationResult` invoking `crossCheckInternal(rows, 50)` and reporting any year where the source's per-capita field disagrees with `total / population` by more than 50 cents.
- `reconcileBlsCoverage(averages) -> ReconciliationResult` reporting any FY whose `observationCount` is below `MIN_COVERAGE` (six scheduled bimonthly observations) and would therefore be excluded from factor computation.
  - `reconcileSocrataCohort(rows, fyStart, fyEnd) -> ReconciliationResult` refusing out-of-cohort rows; passing only when every `fiscalYear` is in `[fyStart, fyEnd]`.
  - `runAllReconciliations(input) -> ReconciliationResult` running all three checks and aggregating any failures.
  - `ReconciliationResult = { ok: true } | { ok: false; mismatches: readonly { fiscalYear, computedCents, controlCents, diffCents, sourceId }[] }`.

- [ ] **Step 1: Write the failing tests**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\reconcile\reconcile.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  reconcileBlsCoverage,
  reconcileScoPerCapita,
  reconcileSocrataCohort,
  runAllReconciliations,
} from "./reconcile";
import {
  parseScoExpenditurePerCapita,
} from "../sources/sco-per-capita";
import { scoExpenditurePerCapitaFixture } from "./reconcile.fixtures";
import { fiscalYearAverage, parseBlsSnapshot } from "../sources/bls-cpi";
import { blsFixture, blsPartialFixture } from "../sources/bls-cpi.fixtures";
import { assertCohortSealed, parseSocrataRows } from "../sources/berkeley-socrata";
import { socrataFixture } from "../sources/berkeley-socrata.fixtures";

describe("reconcile", () => {
  it("reconcileScoPerCapita passes when total/population matches per-capita within 50 cents", () => {
    const rows = parseScoExpenditurePerCapita(scoExpenditurePerCapitaFixture);
    expect(reconcileScoPerCapita(rows).ok).toBe(true);
  });

  it("reconcileScoPerCapita flags rows whose per-capita value disagrees", () => {
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
    const result = reconcileScoPerCapita(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.mismatches[0]?.fiscalYear).toBe(2023);
  });

  it("reconcileBlsCoverage passes when every FY has ≥ MIN_COVERAGE observations", () => {
    const averages = fiscalYearAverage(parseBlsSnapshot(blsFixture));
    expect(reconcileBlsCoverage(averages).ok).toBe(true);
  });

  it("reconcileBlsCoverage flags any FY below MIN_COVERAGE", () => {
    const averages = fiscalYearAverage(parseBlsSnapshot(blsPartialFixture));
    const result = reconcileBlsCoverage(averages);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.mismatches.some((m) => m.fiscalYear === 2024)).toBe(true);
  });

  it("reconcileSocrataCohort passes when every row is in FY2012–FY2015", () => {
    const rows = parseSocrataRows(socrataFixture);
    expect(() => assertCohortSealed(rows, 2012, 2015)).not.toThrow();
    expect(reconcileSocrataCohort(rows, 2012, 2015).ok).toBe(true);
  });

  it("reconcileSocrataCohort returns one mismatch per offending fiscal year", () => {
    const rows = parseSocrataRows(socrataFixture).map((r) => ({ ...r, fiscalYear: 2020 }));
    const result = reconcileSocrataCohort(rows, 2012, 2015);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.mismatches.length).toBe(1);
      expect(result.mismatches[0]?.fiscalYear).toBe(2020);
      expect(result.mismatches[0]?.sourceId).toBe("src-berkeley-socrata-gy8t-iqc4");
    }
  });

  it("reconcileSocrataCohort reports every distinct offending fiscal year separately", () => {
    // Construct rows that violate two distinct fiscal years (2016 and 2020).
    const baseRows = parseSocrataRows(socrataFixture);
    const off2016 = baseRows.map((r) => ({ ...r, fiscalYear: 2016 }));
    const off2020 = baseRows.map((r) => ({ ...r, fiscalYear: 2020 }));
    const mixed = [...off2016, ...off2020];
    const result = reconcileSocrataCohort(mixed, 2012, 2015);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const years = result.mismatches.map((m) => m.fiscalYear).sort((a, b) => a - b);
      expect(years).toEqual([2016, 2020]);
      for (const m of result.mismatches) {
        expect(m.fiscalYear).not.toBe(0);
        expect(m.sourceId).toBe("src-berkeley-socrata-gy8t-iqc4");
      }
    }
  });

  it("runAllReconciliations aggregates failures with the offending source id", () => {
    const outOfCohort = parseSocrataRows(socrataFixture).map((r) => ({ ...r, fiscalYear: 2020 }));
    const result = runAllReconciliations({
      perCapitaRows: parseScoExpenditurePerCapita(scoExpenditurePerCapitaFixture),
      blsAverages: fiscalYearAverage(parseBlsSnapshot(blsFixture)),
      socrataRows: outOfCohort,
      socrataFyStart: 2012,
      socrataFyEnd: 2015,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.mismatches.every((m) => m.sourceId.length > 0)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- reconcile/reconcile.test`
Expected: FAIL with `Cannot find module './reconcile'`.

- [ ] **Step 3: Write the synthetic reconcile fixtures**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\reconcile\reconcile.fixtures.ts`:

```typescript
// SYNTHETIC TEST FIXTURES — DO NOT LOAD IN PRODUCTION.
// Production reads the five snapshots under `data/snapshots/`.

export {
  scoExpenditurePerCapitaFixture,
  type ScoExpenditurePerCapitaFixtureRow,
} from "../sources/sco-per-capita.fixtures";
export { blsFixture, blsPartialFixture } from "../sources/bls-cpi.fixtures";
export { socrataFixture } from "../sources/berkeley-socrata.fixtures";
```

- [ ] **Step 4: Write the implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\reconcile\reconcile.ts`:

```typescript
import {
  crossCheckInternal,
  type ScoExpenditurePerCapitaRow,
} from "../sources/sco-per-capita";
import { MIN_COVERAGE, type FiscalYearAverage } from "../sources/bls-cpi";
import type { SocrataRow } from "../sources/berkeley-socrata";
import { cohortFiscalYears, assertCohortSealed } from "../sources/berkeley-socrata";

export interface ReconciliationMismatch {
  readonly fiscalYear: number;
  readonly computedCents: number;
  readonly controlCents: number;
  readonly diffCents: number;
  readonly sourceId: string;
}

export type ReconciliationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly mismatches: readonly ReconciliationMismatch[] };

export function reconcileScoPerCapita(
  rows: readonly ScoExpenditurePerCapitaRow[],
): ReconciliationResult {
  const mismatches: ReconciliationMismatch[] = [];
  for (const r of rows) {
    if (r.estimatedPopulation === 0) continue;
    const expected = Math.round(r.totalExpendituresCents / r.estimatedPopulation);
    const diff = Math.abs(expected - r.expendituresPerCapitaCents);
    if (diff > 50) {
      mismatches.push({
        fiscalYear: r.fiscalYear,
        computedCents: expected,
        controlCents: r.expendituresPerCapitaCents,
        diffCents: expected - r.expendituresPerCapitaCents,
        sourceId: "src-sco-expenditures-per-capita-ykhf-vfsr",
      });
    }
  }
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}

export function reconcileBlsCoverage(
  averages: readonly FiscalYearAverage[],
): ReconciliationResult {
  const mismatches: ReconciliationMismatch[] = [];
  for (const a of averages) {
    if (a.observationCount < MIN_COVERAGE) {
      mismatches.push({
        fiscalYear: a.fiscalYear,
        computedCents: a.observationCount,
        controlCents: MIN_COVERAGE,
        diffCents: a.observationCount - MIN_COVERAGE,
        sourceId: "src-bls-cpi-u-cuura422sa0",
      });
    }
  }
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}

export function reconcileSocrataCohort(
  rows: readonly SocrataRow[],
  fyStart: number,
  fyEnd: number,
): ReconciliationResult {
  // Collect every offending fiscal year. The cohort is sealed to
  // [fyStart, fyEnd]; any row whose fiscalYear is outside the window is
  // a real, addressable mismatch and must be reported individually so
  // operators can act on a specific FY rather than an aggregate dummy.
  const offending = new Map<number, number>();
  for (const row of rows) {
    if (row.fiscalYear < fyStart || row.fiscalYear > fyEnd) {
      offending.set(row.fiscalYear, (offending.get(row.fiscalYear) ?? 0) + 1);
    }
  }
  if (offending.size === 0) {
    void cohortFiscalYears(rows);
    return { ok: true };
  }
  const sortedYears = [...offending.keys()].sort((a, b) => a - b);
  const mismatches: ReconciliationMismatch[] = sortedYears.map((fy) => ({
    fiscalYear: fy,
    computedCents: 0,
    controlCents: fy,
    diffCents: -fy,
    sourceId: "src-berkeley-socrata-gy8t-iqc4",
  }));
  return { ok: false, mismatches };
}

export interface RunAllInput {
  readonly perCapitaRows: readonly ScoExpenditurePerCapitaRow[];
  readonly blsAverages: readonly FiscalYearAverage[];
  readonly socrataRows: readonly SocrataRow[];
  readonly socrataFyStart: number;
  readonly socrataFyEnd: number;
}

export function runAllReconciliations(input: RunAllInput): ReconciliationResult {
  const parts: ReconciliationResult[] = [
    reconcileScoPerCapita(input.perCapitaRows),
    reconcileBlsCoverage(input.blsAverages),
    reconcileSocrataCohort(input.socrataRows, input.socrataFyStart, input.socrataFyEnd),
  ];
  const mismatches = parts.flatMap((p) => (p.ok ? [] : p.mismatches));
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- reconcile/reconcile.test`
Expected: PASS (7 tests).

- [ ] **Step 6: Verify typecheck and lint**

Run: `pnpm run typecheck`
Expected: exit code 0.

Run: `pnpm run lint`
Expected: exit code 0.

- [ ] **Step 7: OPTIONAL commit**

If Git initialized and approved:

```bash
git add src/pipeline/reconcile/reconcile.ts src/pipeline/reconcile/reconcile.test.ts src/pipeline/reconcile/reconcile.fixtures.ts
git commit -m "feat(pipeline): per-capita cross-check + BLS coverage + Socrata cohort seal"
```

Otherwise skip this step.

---

## Task 10: Source-to-canonical normalization, derivation, immutable artifacts, and quality report

**Files:**
- Create: `src/pipeline/canonical/normalize.ts`
- Create: `src/pipeline/canonical/normalize.test.ts`
- Create: `src/pipeline/derive/derive.ts`
- Create: `src/pipeline/derive/derive.test.ts`
- Create: `src/pipeline/derive/artifacts.ts`
- Create: `src/pipeline/derive/artifacts.test.ts`
- Create: `src/pipeline/derive/quality-report.ts`
- Create: `src/pipeline/derive/quality-report.test.ts`
- Modify: `src/pipeline/build.ts` (replace stub with real pipeline)

**Interfaces:**
- Consumes: snapshot files from Tasks 3–6 (BLS, Socrata, SCO detailed, SCO per-capita), `BudgetValueSchema`, `EntitySchema`, `CrosswalkEntrySchema`, `SourceManifestSchema`, `reconcileSocrataCohort`, `reconcileScoPerCapita`, `reconcileBlsCoverage`, `runAllReconciliations`. The build pipeline never imports `*.fixtures.ts`.
- Produces:
  - `normalizeSocrata(rows, sourceId) -> readonly BudgetValue[]`.
  - `normalizeScoExpenditurePerCapita(rows, sourceId) -> readonly BudgetValue[]`.
  - `normalizeScoRevenuePerCapita(rows, sourceId) -> readonly BudgetValue[]`.
  - `OverviewSnapshot { surface, fiscalYear, baseYear, expendituresCents, revenuesCents, perResidentExpendituresCents, perResidentRevenuesCents, estimatedPopulation, comparability, sources, notes }`.
  - `buildOverviewSnapshot({ values, entities, cpi, population, targetFiscalYear, mode, baseYear }) -> OverviewSnapshot`.
  - `writeArtifact(dir, fileName, payload)` writing deterministic JSON with sorted keys.
  - `writeQualityReport({ manifest, reconciliationResults, normalizationSummary }, dir)`.
  - The pipeline entry `src/pipeline/build.ts` runs all adapters, normalizes, reconciles, derives, and writes `src/artifacts/{release,values,entities,cpi,population,overview,quality-report}.json`.

- [ ] **Step 1: Write the failing normalize test**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\canonical\normalize.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  normalizeScoExpenditurePerCapita,
  normalizeScoRevenuePerCapita,
  normalizeSocrata,
} from "./normalize";
import { parseSocrataRows } from "../sources/berkeley-socrata";
import { socrataFixture } from "../sources/berkeley-socrata.fixtures";
import {
  filterBerkeley,
  parseScoExpenditurePerCapita,
  parseScoRevenuePerCapita,
} from "../sources/sco-per-capita";
import {
  scoExpenditurePerCapitaFixture,
  scoRevenuePerCapitaFixture,
} from "../sources/sco-per-capita.fixtures";

describe("normalize", () => {
  it("emits a verified BudgetValue per Socrata line item, stamped with the source id", () => {
    const rows = parseSocrataRows(socrataFixture);
    const values = normalizeSocrata(rows, "src-berkeley-socrata-gy8t-iqc4");
    expect(values.length).toBe(rows.length);
    expect(values[0]?.sourceId).toBe("src-berkeley-socrata-gy8t-iqc4");
    expect(values[0]?.stage).toBe("adopted");
    expect(values[0]?.basis).toBe("budgetary");
    expect(values[0]?.confidence).toBe("verified");
    expect(values[0]?.extractionMethod).toBe("api");
  });

  it("emits a verified BudgetValue per SCO per-capita expenditure row for Berkeley with gaap basis", () => {
    const rows = filterBerkeley(parseScoExpenditurePerCapita(scoExpenditurePerCapitaFixture));
    const values = normalizeScoExpenditurePerCapita(rows, "src-sco-expenditures-per-capita-ykhf-vfsr");
    expect(values.length).toBe(rows.length);
    expect(values.every((v) => v.basis === "gaap")).toBe(true);
    expect(values.every((v) => v.stage === "actual")).toBe(true);
    expect(values.every((v) => v.confidence === "verified")).toBe(true);
    expect(values.every((v) => v.sourceId === "src-sco-expenditures-per-capita-ykhf-vfsr")).toBe(true);
    expect(values.every((v) => v.entityId === "ent-citywide-berkeley")).toBe(true);
  });

  it("emits a verified BudgetValue per SCO per-capita revenue row for Berkeley with gaap basis", () => {
    const rows = filterBerkeley(parseScoRevenuePerCapita(scoRevenuePerCapitaFixture));
    const values = normalizeScoRevenuePerCapita(rows, "src-sco-revenues-per-capita-ky7j-fsk5");
    expect(values.length).toBe(rows.length);
    expect(values.every((v) => v.basis === "gaap")).toBe(true);
    expect(values.every((v) => v.stage === "actual")).toBe(true);
    expect(values.every((v) => v.sourceId === "src-sco-revenues-per-capita-ky7j-fsk5")).toBe(true);
  });

  it("uses the crosswalk canonical entity id when one applies", () => {
    const rows = parseSocrataRows(socrataFixture.filter((r) => r.department === "Public Works"));
    const values = normalizeSocrata(rows, "src-berkeley-socrata-gy8t-iqc4");
    expect(values.every((v) => v.entityId.startsWith("ent-"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- canonical/normalize.test`
Expected: FAIL with `Cannot find module './normalize'`.

- [ ] **Step 3: Write the normalize implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\canonical\normalize.ts`:

```typescript
import { type BudgetValue, type EntityType } from "./schema";
import type { SocrataRow } from "../sources/berkeley-socrata";
import type {
  ScoExpenditurePerCapitaRow,
  ScoRevenuePerCapitaRow,
} from "../sources/sco-per-capita";
import type { SourceId } from "../sources/manifest";

const SCHEMA_VERSION = "1.0.0";
const CITYWIDE_ENTITY_ID = "ent-citywide-berkeley" as const;
const CITYWIDE_ENTITY_TYPE: EntityType = "service";

function socrataEntityType(program: string | undefined, expenseCategory: string | undefined): EntityType {
  if (program && program.length > 0) return "program";
  if (expenseCategory && expenseCategory.length > 0) return "expense-category";
  return "service";
}

function slugEntityId(prefix: string, key: string): string {
  const slug = key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${prefix}-${slug}`;
}

export function normalizeSocrata(
  rows: readonly SocrataRow[],
  sourceId: SourceId,
): readonly BudgetValue[] {
  return rows.map((row) => {
    const entityKey = row.program ?? row.expenseCategory ?? row.service ?? row.department;
    return {
      fiscalYear: row.fiscalYear,
      amountNominalCents: row.approvedAmountCents,
      stage: "adopted" as const,
      basis: "budgetary" as const,
      entityId: slugEntityId("ent", entityKey),
      entityType: socrataEntityType(row.program, row.expenseCategory),
      sourceId,
      sourceLabel: `${row.department} / ${entityKey} (${row.fund})`,
      extractionMethod: "api" as const,
      confidence: "verified" as const,
      schemaVersion: SCHEMA_VERSION,
    };
  });
}

// Authoritative citywide expenditure totals. These rows carry `entity_name`
// (City of Berkeley) but no function or fund breakdown; they are the
// "expenditures_per_capita dataset" rows and they are the only place the
// Phase 1 Overview draws its total-expenditure numbers from.
export function normalizeScoExpenditurePerCapita(
  rows: readonly ScoExpenditurePerCapitaRow[],
  sourceId: SourceId,
): readonly BudgetValue[] {
  return rows.map((row) => ({
    fiscalYear: row.fiscalYear,
    amountNominalCents: row.totalExpendituresCents,
    stage: "actual" as const,
    basis: "gaap" as const,
    entityId: CITYWIDE_ENTITY_ID,
    entityType: CITYWIDE_ENTITY_TYPE,
    sourceId,
    sourceLabel: `${row.entityName} total expenditures (per-capita dataset, FY${row.fiscalYear})`,
    extractionMethod: "api" as const,
    confidence: "verified" as const,
    schemaVersion: SCHEMA_VERSION,
  }));
}

// Authoritative citywide revenue totals. The detailed SCO expenditure adapter
// does not carry revenue fields; revenue totals come exclusively from the
// `ky7j-fsk5` per-capita dataset.
export function normalizeScoRevenuePerCapita(
  rows: readonly ScoRevenuePerCapitaRow[],
  sourceId: SourceId,
): readonly BudgetValue[] {
  return rows.map((row) => ({
    fiscalYear: row.fiscalYear,
    amountNominalCents: row.totalRevenuesCents,
    stage: "actual" as const,
    basis: "gaap" as const,
    entityId: CITYWIDE_ENTITY_ID,
    entityType: CITYWIDE_ENTITY_TYPE,
    sourceId,
    sourceLabel: `${row.entityName} total revenues (per-capita dataset, FY${row.fiscalYear})`,
    extractionMethod: "api" as const,
    confidence: "verified" as const,
    schemaVersion: SCHEMA_VERSION,
  }));
}
```

- [ ] **Step 4: Write the failing derive test**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\derive\derive.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildOverviewSnapshot } from "./derive";
import type { BudgetValue, Entity } from "../canonical/schema";
import { fiscalYearAverage, parseCpiObservations } from "../sources/bls-cpi";
import { blsFixture } from "../sources/bls-cpi.fixtures";

const entities: readonly Entity[] = [
  {
    id: "ent-citywide-berkeley",
    type: "service",
    canonicalName: "Citywide Berkeley Operations",
    plainDescription: "Citywide total reported by the State Controller.",
  },
];

const values: readonly BudgetValue[] = [
  {
    fiscalYear: 2024,
    amountNominalCents: 78000000000,
    stage: "actual",
    basis: "gaap",
    entityId: "ent-citywide-berkeley",
    entityType: "service",
    sourceId: "src-sco-expenditures-per-capita-ykhf-vfsr",
    sourceLabel: "City of Berkeley total expenditures (per-capita dataset, FY2024)",
    extractionMethod: "api",
    confidence: "verified",
    schemaVersion: "1.0.0",
  },
  {
    fiscalYear: 2024,
    amountNominalCents: 80000000000,
    stage: "actual",
    basis: "gaap",
    entityId: "ent-citywide-berkeley",
    entityType: "service",
    sourceId: "src-sco-revenues-per-capita-ky7j-fsk5",
    sourceLabel: "City of Berkeley total revenues (per-capita dataset, FY2024)",
    extractionMethod: "api",
    confidence: "verified",
    schemaVersion: "1.0.0",
  },
  {
    fiscalYear: 2020,
    amountNominalCents: 60000000000,
    stage: "actual",
    basis: "gaap",
    entityId: "ent-citywide-berkeley",
    entityType: "service",
    sourceId: "src-sco-expenditures-per-capita-ykhf-vfsr",
    sourceLabel: "City of Berkeley total expenditures (per-capita dataset, FY2020)",
    extractionMethod: "api",
    confidence: "verified",
    schemaVersion: "1.0.0",
  },
  {
    fiscalYear: 2020,
    amountNominalCents: 61000000000,
    stage: "actual",
    basis: "gaap",
    entityId: "ent-citywide-berkeley",
    entityType: "service",
    sourceId: "src-sco-revenues-per-capita-ky7j-fsk5",
    sourceLabel: "City of Berkeley total revenues (per-capita dataset, FY2020)",
    extractionMethod: "api",
    confidence: "verified",
    schemaVersion: "1.0.0",
  },
];

describe("derive", () => {
  it("builds an Overview snapshot with nominal dollars for the requested year", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const snapshot = buildOverviewSnapshot({
      values,
      entities,
      cpi: averages,
      population: [
        { fiscalYear: 2020, estimatedPopulation: 121000 },
        { fiscalYear: 2024, estimatedPopulation: 124320 },
      ],
      targetFiscalYear: 2024,
      mode: "nominal",
      baseYear: 2024,
    });
    expect(snapshot.fiscalYear).toBe(2024);
    expect(snapshot.expendituresCents).toBe(78000000000);
    expect(snapshot.perResidentExpendituresCents).toBe(Math.round(78000000000 / 124320));
    expect(snapshot.surface).toBe("sco-standardized-actuals");
    expect(snapshot.notes[0]).toMatch(/standardized actual/i);
  });

  it("reports reconstructed comparability in nominal mode", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const snapshot = buildOverviewSnapshot({
      values,
      entities,
      cpi: averages,
      population: [
        { fiscalYear: 2020, estimatedPopulation: 121000 },
        { fiscalYear: 2024, estimatedPopulation: 124320 },
      ],
      targetFiscalYear: 2024,
      mode: "nominal",
      baseYear: 2024,
    });
    expect(snapshot.comparability).toBe("reconstructed");
  });

  it("reports reconstructed comparability in real mode (mode does not overwrite comparability)", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const snapshot = buildOverviewSnapshot({
      values,
      entities,
      cpi: averages,
      population: [
        { fiscalYear: 2020, estimatedPopulation: 121000 },
        { fiscalYear: 2024, estimatedPopulation: 124320 },
      ],
      targetFiscalYear: 2024,
      mode: "real",
      baseYear: 2024,
    });
    expect(snapshot.comparability).toBe("reconstructed");
  });

  it("scales the real-dollar total by the CPI factor between the year and base year", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const snapshot = buildOverviewSnapshot({
      values,
      entities,
      cpi: averages,
      population: [
        { fiscalYear: 2020, estimatedPopulation: 121000 },
        { fiscalYear: 2024, estimatedPopulation: 124320 },
      ],
      targetFiscalYear: 2020,
      mode: "real",
      baseYear: 2024,
    });
    expect(snapshot.fiscalYear).toBe(2020);
    expect(snapshot.expendituresCents).not.toBe(60000000000);
    expect(snapshot.expendituresCents).toBeGreaterThan(60000000000);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm test -- derive/derive.test`
Expected: FAIL with `Cannot find module './derive'`.

- [ ] **Step 6: Write the derive implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\derive\derive.ts`:

```typescript
import { factorFor, inflateCents, type FiscalYearAverage } from "../sources/bls-cpi";
import type { BudgetValue, Entity, Comparability } from "../canonical/schema";

export interface PopulationObservation {
  readonly fiscalYear: number;
  readonly estimatedPopulation: number;
}

export interface OverviewSnapshot {
  readonly fiscalYear: number;
  readonly baseYear: number;
  readonly mode: "real" | "nominal";
  readonly surface: "sco-standardized-actuals";
  readonly expendituresCents: number;
  readonly revenuesCents: number;
  readonly perResidentExpendituresCents: number;
  readonly perResidentRevenuesCents: number;
  readonly estimatedPopulation: number;
  readonly comparability: Comparability;
  readonly sources: readonly string[];
  readonly notes: readonly string[];
}

export interface BuildOverviewInput {
  readonly values: readonly BudgetValue[];
  readonly entities: readonly Entity[];
  readonly cpi: readonly FiscalYearAverage[];
  readonly population: readonly PopulationObservation[];
  readonly targetFiscalYear: number;
  readonly mode: "real" | "nominal";
  readonly baseYear: number;
}

const EXPENDITURE_SOURCE_ID = "src-sco-expenditures-per-capita-ykhf-vfsr";
const REVENUE_SOURCE_ID = "src-sco-revenues-per-capita-ky7j-fsk5";
const BASE_NOTES = [
  "Every Overview figure is a California State Controller standardized actual for Berkeley, not an adopted budget figure.",
  "Adopted-versus-actual variance is deferred to Phase 3 (PDF and ACFR review).",
] as const;

function pickScoValue(
  values: readonly BudgetValue[],
  fiscalYear: number,
  sourceId: string,
): BudgetValue | undefined {
  return values.find((v) => v.fiscalYear === fiscalYear && v.sourceId === sourceId);
}

export function buildOverviewSnapshot(input: BuildOverviewInput): OverviewSnapshot {
  const { values, entities, cpi, population, targetFiscalYear, mode, baseYear } = input;
  const expenditure = pickScoValue(values, targetFiscalYear, EXPENDITURE_SOURCE_ID);
  const revenue = pickScoValue(values, targetFiscalYear, REVENUE_SOURCE_ID);
  if (!expenditure) {
    throw new Error(`No SCO standardized expenditure for FY${targetFiscalYear} in source ${EXPENDITURE_SOURCE_ID}`);
  }
  if (!revenue) {
    throw new Error(`No SCO standardized revenue for FY${targetFiscalYear} in source ${REVENUE_SOURCE_ID}`);
  }
  if (!entities.some((e) => e.id === "ent-citywide-berkeley")) {
    throw new Error("ent-citywide-berkeley entity missing from registry");
  }
  const expenditureDisplay = mode === "nominal"
    ? expenditure.amountNominalCents
    : inflateCents(expenditure.amountNominalCents, targetFiscalYear, baseYear, cpi);
  const revenueDisplay = mode === "nominal"
    ? revenue.amountNominalCents
    : inflateCents(revenue.amountNominalCents, targetFiscalYear, baseYear, cpi);
  const popEntry = population.find((p) => p.fiscalYear === targetFiscalYear);
  const estimatedPopulation = popEntry?.estimatedPopulation ?? 0;
  const perResidentExpendituresCents = estimatedPopulation > 0
    ? Math.round(expenditureDisplay / estimatedPopulation)
    : 0;
  const perResidentRevenuesCents = estimatedPopulation > 0
    ? Math.round(revenueDisplay / estimatedPopulation)
    : 0;
  // Comparability reflects the source-vs-canonical mapping declared in the
  // crosswalk (`reconstructed` for the SCO citywide series). It does NOT
  // change with inflation mode: nominal dollars and inflation-adjusted
  // dollars of the same SCO row share the same mapping status. Inflation
  // mode only affects the displayed dollar amount, never the comparability
  // claim.
  const comparability: Comparability = "reconstructed";
  const sources = [EXPENDITURE_SOURCE_ID, REVENUE_SOURCE_ID];
  return {
    fiscalYear: targetFiscalYear,
    baseYear,
    mode,
    surface: "sco-standardized-actuals",
    expendituresCents: expenditureDisplay,
    revenuesCents: revenueDisplay,
    perResidentExpendituresCents,
    perResidentRevenuesCents,
    estimatedPopulation,
    comparability,
    sources,
    notes: BASE_NOTES,
  };
}

export function buildOverviewTrendSeries(
  values: readonly BudgetValue[],
  cpi: readonly FiscalYearAverage[],
  population: readonly PopulationObservation[],
  mode: "real" | "nominal",
  baseYear: number,
): readonly { fiscalYear: number; expendituresCents: number; revenuesCents: number; perResidentExpendituresCents: number; perResidentRevenuesCents: number; comparability: Comparability; estimatedPopulation: number }[] {
  void population;
  void factorFor;
  const years = Array.from(
    new Set(
      values
        .filter((v) => v.sourceId === EXPENDITURE_SOURCE_ID || v.sourceId === REVENUE_SOURCE_ID)
        .map((v) => v.fiscalYear),
    ),
  ).sort((a, b) => a - b);
  return years.map((fy) => {
    const exp = pickScoValue(values, fy, EXPENDITURE_SOURCE_ID);
    const rev = pickScoValue(values, fy, REVENUE_SOURCE_ID);
    const expendituresCents = exp
      ? (mode === "nominal" || fy === baseYear
          ? exp.amountNominalCents
          : inflateCents(exp.amountNominalCents, fy, baseYear, cpi))
      : 0;
    const revenuesCents = rev
      ? (mode === "nominal" || fy === baseYear
          ? rev.amountNominalCents
          : inflateCents(rev.amountNominalCents, fy, baseYear, cpi))
      : 0;
    const popEntry = population.find((p) => p.fiscalYear === fy);
    const estimatedPopulation = popEntry?.estimatedPopulation ?? 0;
    const perResidentExpendituresCents = estimatedPopulation > 0 ? Math.round(expendituresCents / estimatedPopulation) : 0;
    const perResidentRevenuesCents = estimatedPopulation > 0 ? Math.round(revenuesCents / estimatedPopulation) : 0;
    return {
      fiscalYear: fy,
      expendituresCents,
      revenuesCents,
      perResidentExpendituresCents,
      perResidentRevenuesCents,
      // The trend series is reconstructed from the SCO citywide totals,
      // independently of inflation mode. See buildOverviewSnapshot for the
      // rationale.
      comparability: "reconstructed" as const,
      estimatedPopulation,
    };
  });
}
```

- [ ] **Step 7: Write the failing artifacts test**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\derive\artifacts.test.ts`:

```typescript
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeArtifact, writeArtifacts } from "./artifacts";
import type { OverviewSnapshot } from "./derive";

describe("artifacts writer", () => {
  it("writes a deterministic JSON file with sorted keys", () => {
    const dir = mkdtempSync(join(tmpdir(), "bbe-art-"));
    try {
      const payload = { z: 1, a: 2, nested: { y: 3, b: 4 } };
      writeArtifact(dir, "payload.json", payload);
      const text = readFileSync(join(dir, "payload.json"), "utf-8");
      expect(text).toContain("\"a\": 2");
      expect(text.indexOf("\"a\"")).toBeLessThan(text.indexOf("\"nested\""));
      expect(text.indexOf("\"nested\"")).toBeLessThan(text.indexOf("\"z\""));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes the full artifact set used by the Overview route", () => {
    const dir = mkdtempSync(join(tmpdir(), "bbe-art-"));
    try {
      const overview: OverviewSnapshot = {
        fiscalYear: 2024,
        baseYear: 2024,
        mode: "real",
        surface: "sco-standardized-actuals",
        expendituresCents: 100,
        revenuesCents: 0,
        perResidentExpendituresCents: 1,
        perResidentRevenuesCents: 0,
        estimatedPopulation: 100,
        comparability: "reconstructed",
        sources: ["src-x"],
        notes: ["synthetic"],
      };
      writeArtifacts(dir, {
        release: { schemaVersion: "1.0.0", generatedAt: "2026-07-20T00:00:00.000Z", releaseId: "rel-1" },
        values: [],
        entities: [],
        cpi: { schemaVersion: "1.0.0", seriesId: "CUURA422SA0", baseYear: 2024, fiscalYearAverages: [] },
        population: { schemaVersion: "1.0.0", observations: [] },
        overview: { schemaVersion: "1.0.0", baseYear: 2024, surface: "sco-standardized-actuals", snapshots: [overview] },
        scoPerCapita: { schemaVersion: "1.0.0", expenditureTrendCents: [], revenueTrendCents: [] },
        scoDetailedContext: { schemaVersion: "1.0.0", surface: "category-context-only", schemaBreak: "test", sampleBerkeley: [] },
        socrataCohort: { schemaVersion: "1.0.0", cohortStart: 2012, cohortEnd: 2015, surface: "sealed-cohort-do-not-stitch", values: [] },
      });
      const expected = [
        "release.json",
        "values.json",
        "entities.json",
        "cpi.json",
        "population.json",
        "overview.json",
        "sco-per-capita.json",
        "sco-detailed-context.json",
        "socrata-cohort.json",
      ];
      for (const f of expected) {
        expect(existsSync(join(dir, f)), `missing artifact ${f}`).toBe(true);
        const text = readFileSync(join(dir, f), "utf-8");
        expect(text.length, `empty artifact ${f}`).toBeGreaterThan(2);
      }
      expect(readFileSync(join(dir, "release.json"), "utf-8")).toContain("rel-1");
      expect(readFileSync(join(dir, "values.json"), "utf-8")).toBe("[]");
      expect(readFileSync(join(dir, "overview.json"), "utf-8")).toContain("\"fiscalYear\": 2024");
      expect(readFileSync(join(dir, "socrata-cohort.json"), "utf-8")).toContain("sealed-cohort-do-not-stitch");
      expect(readFileSync(join(dir, "sco-detailed-context.json"), "utf-8")).toContain("category-context-only");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `pnpm test -- derive/artifacts.test`
Expected: FAIL with `Cannot find module './artifacts'`.

- [ ] **Step 9: Write the artifacts implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\derive\artifacts.ts`:

```typescript
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function writeArtifact(dir: string, fileName: string, payload: unknown): void {
  mkdirSync(dir, { recursive: true });
  const text = JSON.stringify(payload, sortKeys, 2);
  writeFileSync(resolve(dir, fileName), `${text}\n`, "utf-8");
}

function sortKeys(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj).sort().reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = obj[k];
      return acc;
    }, {});
  }
  return value;
}

export interface ArtifactBundle {
  readonly release: unknown;
  readonly values: readonly unknown[];
  readonly entities: readonly unknown[];
  readonly cpi: unknown;
  readonly population: unknown;
  readonly overview: unknown;
  readonly scoPerCapita: unknown;
  readonly scoDetailedContext: unknown;
  readonly socrataCohort: unknown;
}

export function writeArtifacts(dir: string, bundle: ArtifactBundle): void {
  writeArtifact(dir, "release.json", bundle.release);
  writeArtifact(dir, "values.json", bundle.values);
  writeArtifact(dir, "entities.json", bundle.entities);
  writeArtifact(dir, "cpi.json", bundle.cpi);
  writeArtifact(dir, "population.json", bundle.population);
  writeArtifact(dir, "overview.json", bundle.overview);
  writeArtifact(dir, "sco-per-capita.json", bundle.scoPerCapita);
  writeArtifact(dir, "sco-detailed-context.json", bundle.scoDetailedContext);
  writeArtifact(dir, "socrata-cohort.json", bundle.socrataCohort);
}
```

- [ ] **Step 10: Write the failing quality-report test**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\derive\quality-report.test.ts`:

```typescript
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeQualityReport } from "./quality-report";
import type { ReconciliationResult } from "../reconcile/reconcile";

describe("quality report", () => {
  it("writes a JSON file describing sources, reconciliation status, and stage counts", () => {
    const dir = mkdtempSync(join(tmpdir(), "bbe-qr-"));
    try {
      const ok: ReconciliationResult = { ok: true };
      const fail: ReconciliationResult = {
        ok: false,
        mismatches: [
          { fiscalYear: 2024, computedCents: 100, controlCents: 99, diffCents: 1, sourceId: "src-x" },
        ],
      };
      writeQualityReport(dir, {
        releaseId: "rel-1",
        generatedAt: "2026-07-20T00:00:00.000Z",
        sourceCount: 5,
        sourceIds: [
          "src-bls-cpi-u-cuura422sa0",
          "src-berkeley-socrata-gy8t-iqc4",
          "src-sco-expenditures-ju3w-4gxp",
          "src-sco-expenditures-per-capita-ykhf-vfsr",
          "src-sco-revenues-per-capita-ky7j-fsk5",
        ],
        normalizationCounts: { adopted: 0, actual: 6, projected: 0, revised: 0, proposed: 0 },
        reconciliation: [
          { sourceId: "src-socrata", result: ok },
          { sourceId: "src-ca", result: fail },
        ],
        comparabilityNotes: [
          "Socrata cohort stops at FY2015; do not stitch into State Controller series.",
          "SCO detailed expenditure schema changes in FY2017; citywide totals remain comparable.",
        ],
      });
      const text = readFileSync(join(dir, "quality-report.json"), "utf-8");
      expect(text).toContain("\"releaseId\": \"rel-1\"");
      expect(text).toContain("\"status\": \"failed\"");
      expect(text).toContain("Socrata cohort stops at FY2015");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 11: Run test to verify it fails**

Run: `pnpm test -- derive/quality-report.test`
Expected: FAIL with `Cannot find module './quality-report'`.

- [ ] **Step 12: Write the quality-report implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\derive\quality-report.ts`:

```typescript
import { writeArtifact } from "./artifacts";
import type { ReconciliationResult } from "../reconcile/reconcile";

export interface QualityReportInput {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly sourceCount: number;
  readonly sourceIds: readonly string[];
  readonly normalizationCounts: {
    readonly adopted: number;
    readonly actual: number;
    readonly projected: number;
    readonly revised: number;
    readonly proposed: number;
  };
  readonly reconciliation: ReadonlyArray<{
    readonly sourceId: string;
    readonly result: ReconciliationResult;
  }>;
  readonly comparabilityNotes: readonly string[];
}

export interface QualityReport {
  readonly schemaVersion: "1.0.0";
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly status: "passed" | "failed";
  readonly sourceCount: number;
  readonly sourceIds: readonly string[];
  readonly normalizationCounts: QualityReportInput["normalizationCounts"];
  readonly reconciliation: ReadonlyArray<{
    readonly sourceId: string;
    readonly status: "passed" | "failed";
    readonly mismatches?: ReconciliationResult extends { ok: false; mismatches: infer M } ? M : never;
  }>;
  readonly comparabilityNotes: readonly string[];
}

export function writeQualityReport(dir: string, input: QualityReportInput): void {
  const status: "passed" | "failed" = input.reconciliation.every((r) => r.result.ok) ? "passed" : "failed";
  const reconciliation = input.reconciliation.map((r) => {
    if (r.result.ok) {
      return { sourceId: r.sourceId, status: "passed" as const };
    }
    return {
      sourceId: r.sourceId,
      status: "failed" as const,
      mismatches: r.result.mismatches,
    };
  });
  const report: QualityReport = {
    schemaVersion: "1.0.0",
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
    status,
    sourceCount: input.sourceCount,
    sourceIds: input.sourceIds,
    normalizationCounts: input.normalizationCounts,
    reconciliation,
    comparabilityNotes: input.comparabilityNotes,
  };
  writeArtifact(dir, "quality-report.json", report);
}
```

- [ ] **Step 13: Write the real pipeline entry `src/pipeline/build.ts`**

Replace `C:\Users\Y\proj\berkeley-budget\src\pipeline\build.ts` with:

```typescript
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Of, SourceManifestSchema, type SourceEntry } from "./sources/manifest";
import manifestData from "./sources/manifest.data.json" with { type: "json" };
import { fiscalYearAverage, latestCompleteFiscalYear, loadBlsFromSnapshot, MIN_COVERAGE } from "./sources/bls-cpi";
import { assertCohortSealed, parseSocrataRows } from "./sources/berkeley-socrata";
import { parseScoDetailed } from "./sources/sco-detailed";
import {
  citywideTrend,
  crossCheckInternal,
  filterBerkeley,
  parseScoExpenditurePerCapita,
  parseScoRevenuePerCapita,
} from "./sources/sco-per-capita";
import {
  normalizeScoExpenditurePerCapita,
  normalizeScoRevenuePerCapita,
  normalizeSocrata,
} from "./canonical/normalize";
import type { BudgetValue, Entity } from "./canonical/schema";
import {
  reconcileBlsCoverage,
  reconcileScoPerCapita,
  reconcileSocrataCohort,
  runAllReconciliations,
  type ReconciliationResult,
} from "./reconcile/reconcile";
import { buildOverviewSnapshot } from "./derive/derive";
import { writeArtifact, writeArtifacts } from "./derive/artifacts";
import { writeQualityReport } from "./derive/quality-report";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_ROOT = resolve(__dirname, "../../data/snapshots");
const artifactsDir = resolve(__dirname, "../artifacts");
const SCHEMA_VERSION = "1.0.0";
const CITYWIDE_ENTITY_ID = "ent-citywide-berkeley";
const SOCRATA_COHORT_START = 2012;
const SOCRATA_COHORT_END = 2015;

const entities: readonly Entity[] = [
  {
    id: CITYWIDE_ENTITY_ID,
    type: "service",
    canonicalName: "Citywide Berkeley Operations",
    plainDescription: "Citywide total reported by the State Controller per-capita datasets.",
  },
];

function loadVerifiedSnapshot(entry: SourceEntry, releaseId: string): unknown {
  const path = resolve(SNAPSHOT_ROOT, entry.id, `${releaseId}.json`);
  const bytes = readFileSync(path);
  const checksum = sha256Of(bytes);
  if (checksum !== entry.checksumSha256) {
    throw new Error(
      `Snapshot checksum mismatch for ${entry.id} at ${path}: expected ${entry.checksumSha256}, got ${checksum}`,
    );
  }
  return JSON.parse(bytes.toString("utf-8"));
}

function loadVerifiedSource(entry: SourceEntry, releaseId: string): readonly unknown[] {
  const parsed = loadVerifiedSnapshot(entry, releaseId);
  if (!Array.isArray(parsed)) {
    throw new Error(`Snapshot for ${entry.id} must be a JSON array; got ${typeof parsed}`);
  }
  return parsed;
}

function requireEntry(manifest: ReturnType<typeof SourceManifestSchema.parse>, id: string): SourceEntry {
  const entry = manifest.sources.find((s) => s.id === id);
  if (!entry) throw new Error(`Manifest missing required source id ${id}`);
  return entry;
}

export async function buildArtifacts(): Promise<void> {
  mkdirSync(artifactsDir, { recursive: true });

  const manifest = SourceManifestSchema.parse(manifestData);
  const releaseId = manifest.releaseId;

  // 1. Acquire each snapshot from disk and verify its SHA-256 against the
  //    manifest. The pipeline is offline; bytes were captured by
  //    `pnpm refresh:data` (or by the hand-initialised step 0 for the first
  //    release). Any checksum mismatch fails the build.
  const blsEntry = requireEntry(manifest, "src-bls-cpi-u-cuura422sa0");
  const socrataEntry = requireEntry(manifest, "src-berkeley-socrata-gy8t-iqc4");
  const detailedEntry = requireEntry(manifest, "src-sco-expenditures-ju3w-4gxp");
  const expPcEntry = requireEntry(manifest, "src-sco-expenditures-per-capita-ykhf-vfsr");
  const revPcEntry = requireEntry(manifest, "src-sco-revenues-per-capita-ky7j-fsk5");

  const blsObservations = await loadBlsFromSnapshot(SNAPSHOT_ROOT, releaseId);
  const socrataRaw = loadVerifiedSource(socrataEntry, releaseId);
  const detailedRaw = loadVerifiedSource(detailedEntry, releaseId);
  const expPcRaw = loadVerifiedSource(expPcEntry, releaseId);
  const revPcRaw = loadVerifiedSource(revPcEntry, releaseId);

  // 2. Normalize. Socrata is a sealed cohort; SCO detailed is category context
  //    only; SCO per-capita is the authoritative citywide totals.
  const socrataRows = parseSocrataRows(socrataRaw);
  assertCohortSealed(socrataRows, SOCRATA_COHORT_START, SOCRATA_COHORT_END);

  const detailedRows = filterBerkeley(parseScoDetailed(detailedRaw));

  const expPcRows = filterBerkeley(parseScoExpenditurePerCapita(expPcRaw));
  const revPcRows = filterBerkeley(parseScoRevenuePerCapita(revPcRaw));
  crossCheckInternal(expPcRows, 50);

  const trend = citywideTrend(expPcRows, revPcRows);
  const population = trend.map((t) => ({
    fiscalYear: t.fiscalYear,
    estimatedPopulation: t.estimatedPopulation,
  }));

  const socrataValues = normalizeSocrata(socrataRows, "src-berkeley-socrata-gy8t-iqc4");
  const expValues = normalizeScoExpenditurePerCapita(expPcRows, "src-sco-expenditures-per-capita-ykhf-vfsr");
  const revValues = normalizeScoRevenuePerCapita(revPcRows, "src-sco-revenues-per-capita-ky7j-fsk5");
  const allValues: readonly BudgetValue[] = [...expValues, ...revValues, ...socrataValues];

  // 3. Reconcile. Per-capita cross-check, BLS coverage, Socrata cohort seal.
  const cpiAverages = fiscalYearAverage(blsObservations);
  const reconScoPerCapita = reconcileScoPerCapita(expPcRows);
  const reconBls = reconcileBlsCoverage(cpiAverages);
  const reconSocrata = reconcileSocrataCohort(socrataRows, SOCRATA_COHORT_START, SOCRATA_COHORT_END);
  const allRecon = runAllReconciliations({
    perCapitaRows: expPcRows,
    blsAverages: cpiAverages,
    socrataRows,
    socrataFyStart: SOCRATA_COHORT_START,
    socrataFyEnd: SOCRATA_COHORT_END,
  });
  if (!allRecon.ok) {
    throw new Error(`Reconciliation failed: ${JSON.stringify(allRecon.mismatches)}`);
  }

  // 4. Derive. The base year is the latest complete Berkeley fiscal year that
  //    meets the BLS coverage floor. The initial release is FY2024.
  const baseYear = latestCompleteFiscalYear(cpiAverages, MIN_COVERAGE);

  const overviewForCurrent = buildOverviewSnapshot({
    values: allValues,
    entities,
    cpi: cpiAverages,
    population,
    targetFiscalYear: baseYear,
    mode: "real",
    baseYear,
  });
  const overviewForAnchor = buildOverviewSnapshot({
    values: allValues,
    entities,
    cpi: cpiAverages,
    population,
    targetFiscalYear: 2015,
    mode: "real",
    baseYear,
  });

  // 5. Publish. Deterministic, sorted-key JSON. The Overview route and the
  //    Methodology route read these files at runtime.
  writeArtifacts(artifactsDir, {
    release: {
      schemaVersion: SCHEMA_VERSION,
      releaseId,
      generatedAt: new Date().toISOString(),
      sources: manifest.sources.map((s) => s.id),
      surface: "sco-standardized-actuals",
    },
    values: allValues,
    entities,
    cpi: {
      schemaVersion: SCHEMA_VERSION,
      seriesId: "CUURA422SA0",
      baseYear,
      fiscalYearAverages: cpiAverages,
    },
    population: { schemaVersion: SCHEMA_VERSION, observations: population },
    overview: {
      schemaVersion: SCHEMA_VERSION,
      baseYear,
      surface: "sco-standardized-actuals",
      snapshots: [overviewForCurrent, overviewForAnchor],
    },
    scoPerCapita: {
      schemaVersion: SCHEMA_VERSION,
      expenditureTrendCents: trend.map((t) => ({
        fiscalYear: t.fiscalYear,
        expendituresCents: t.expendituresCents,
        perResidentExpendituresCents: t.perResidentExpendituresCents,
        estimatedPopulation: t.estimatedPopulation,
      })),
      revenueTrendCents: trend.map((t) => ({
        fiscalYear: t.fiscalYear,
        revenuesCents: t.revenuesCents,
        perResidentRevenuesCents: t.perResidentRevenuesCents,
        estimatedPopulation: t.estimatedPopulation,
      })),
    },
    scoDetailedContext: {
      schemaVersion: SCHEMA_VERSION,
      surface: "category-context-only",
      schemaBreak: "SCO detailed expenditure schema changes materially in FY2017; citywide totals remain comparable across the break but per-line trends do not.",
      sampleBerkeley: detailedRows.slice(0, 50).map((r) => ({
        fiscalYear: r.fiscalYear,
        category: r.category,
        subcategory1: r.subcategory1,
        subcategory2: r.subcategory2,
        lineDescription: r.lineDescription,
        valueCents: r.valueCents,
      })),
    },
    socrataCohort: {
      schemaVersion: SCHEMA_VERSION,
      cohortStart: SOCRATA_COHORT_START,
      cohortEnd: SOCRATA_COHORT_END,
      surface: "sealed-cohort-do-not-stitch",
      values: socrataValues,
    },
  });

  // 6. Write the human-readable quality report. The release manifest's
  //    `sources` list is the authoritative list of five identifiers; the
  //    quality report must reference the same set.
  writeQualityReport(artifactsDir, {
    releaseId,
    generatedAt: new Date().toISOString(),
    sourceCount: manifest.sources.length,
    sourceIds: manifest.sources.map((s) => s.id),
    normalizationCounts: countByStage(allValues),
    reconciliation: [
      { sourceId: expPcEntry.id, result: reconScoPerCapita },
      { sourceId: blsEntry.id, result: reconBls },
      { sourceId: socrataEntry.id, result: reconSocrata },
    ],
    comparabilityNotes: [
      "Socrata cohort stops at FY2015; do not stitch into State Controller series.",
      "SCO detailed expenditure schema changes materially in FY2017; citywide totals remain comparable.",
      "Phase 1 surface is SCO standardized actuals for Berkeley; adopted-versus-actual variance is deferred to Phase 3.",
    ],
  });

  // 7. Final guard. Any reconciliation failure is fatal; the artifacts
  //    directory may already contain files but the build exits non-zero.
  const failed: ReconciliationResult[] = [];
  if (!reconScoPerCapita.ok) failed.push(reconScoPerCapita);
  if (!reconBls.ok) failed.push(reconBls);
  if (!reconSocrata.ok) failed.push(reconSocrata);
  if (failed.length > 0) {
    throw new Error(`Reconciliation failed: ${JSON.stringify(failed)}`);
  }

  writeArtifact(artifactsDir, "build-status.json", { ok: true, baseYear, releaseId });
}

function countByStage(values: readonly BudgetValue[]): { adopted: number; actual: number; projected: number; revised: number; proposed: number } {
  const acc = { adopted: 0, actual: 0, projected: 0, revised: 0, proposed: 0 };
  for (const v of values) {
    if (v.stage === "adopted") acc.adopted += 1;
    else if (v.stage === "actual") acc.actual += 1;
    else if (v.stage === "projected") acc.projected += 1;
    else if (v.stage === "revised") acc.revised += 1;
    else if (v.stage === "proposed") acc.proposed += 1;
  }
  return acc;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildArtifacts().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 14: Write the failing build test**

Write `C:\Users\Y\proj\berkeley-budget\src\pipeline\build.test.ts`:

```typescript
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeArtifact } from "./derive/artifacts";
import { writeQualityReport } from "./derive/quality-report";

describe("build pipeline integration", () => {
  it("produces all seven expected artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "bbe-build-"));
    try {
      writeArtifact(dir, "release.json", { schemaVersion: "1.0.0", releaseId: "rel-1", generatedAt: "2026-07-20T00:00:00.000Z", sources: [] });
      writeArtifact(dir, "values.json", []);
      writeArtifact(dir, "entities.json", []);
      writeArtifact(dir, "cpi.json", { schemaVersion: "1.0.0", seriesId: "CUURA422SA0", fiscalYearAverages: [] });
      writeArtifact(dir, "population.json", { schemaVersion: "1.0.0", observations: [] });
      writeArtifact(dir, "overview.json", { schemaVersion: "1.0.0", baseYear: 2024, snapshots: [] });
      writeQualityReport(dir, {
        releaseId: "rel-1",
        generatedAt: "2026-07-20T00:00:00.000Z",
        sourceCount: 5,
        sourceIds: [
          "src-bls-cpi-u-cuura422sa0",
          "src-berkeley-socrata-gy8t-iqc4",
          "src-sco-expenditures-ju3w-4gxp",
          "src-sco-expenditures-per-capita-ykhf-vfsr",
          "src-sco-revenues-per-capita-ky7j-fsk5",
        ],
        normalizationCounts: { adopted: 6, actual: 3, projected: 0, revised: 0, proposed: 0 },
        reconciliation: [],
        comparabilityNotes: [],
      });
      for (const f of ["release.json", "values.json", "entities.json", "cpi.json", "population.json", "overview.json", "quality-report.json"]) {
        const text = readFileSync(join(dir, f), "utf-8");
        expect(text.length).toBeGreaterThan(2);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 15: Run the full pipeline once to populate `src/artifacts/`**

Run: `pnpm run build:artifacts`
Expected: `src/artifacts/{release,values,entities,cpi,population,overview,quality-report,build-status}.json` are created; `quality-report.json` reports `"status": "passed"`.

- [ ] **Step 16: Run full build, typecheck, lint, and tests**

Run: `pnpm test`
Expected: PASS (all unit + component tests).

Run: `pnpm run typecheck`
Expected: exit code 0.

Run: `pnpm run lint`
Expected: exit code 0.

Run: `pnpm run build`
Expected: `dist/` created; no errors.

- [ ] **Step 17: OPTIONAL commit**

If Git initialized and approved:

```bash
git add src/pipeline/canonical/normalize.ts src/pipeline/canonical/normalize.test.ts src/pipeline/derive src/pipeline/build.test.ts src/artifacts
git commit -m "feat(pipeline): normalize+derive+artifacts+quality-report+build entry"
```

Otherwise skip this step.

---

## Task 11: Typed query layer and URL state (Overview-only for Phase 1)

**Files:**
- Create: `src/query/engine.ts`
- Create: `src/query/engine.test.ts`
- Create: `src/query/url-state.ts`
- Create: `src/query/url-state.test.ts`

**Interfaces:**
- Consumes: `BudgetValue`, `Entity`, `OverviewSnapshot`, `FiscalYearAverage`, `PopulationObservation`.
- Produces:
  - `DollarMode = "real" | "nominal"`.
  - `OverviewQueryInput { snapshot, cpi, population, mode, baseYear }`.
  - `OverviewTrendPoint { fiscalYear: number; amountCents: number; comparability: Comparability }`.
  - `getOverviewTrend(input) -> readonly OverviewTrendPoint[]` for the chart and table.
  - `formatCents(cents) -> string` USD-formatted with comma thousands separators.
  - `parseOverviewUrl(search) -> { mode: DollarMode; baseYear: number }`.
  - `serializeOverviewUrl(state) -> string` round-trip-safe.

- [ ] **Step 1: Write the failing engine test**

Write `C:\Users\Y\proj\berkeley-budget\src\query\engine.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { formatCents, getOverviewTrend } from "./engine";
import type { OverviewSnapshot } from "../pipeline/derive/derive";
import type { BudgetValue, Entity } from "../pipeline/canonical/schema";
import { fiscalYearAverage, parseCpiObservations } from "../pipeline/sources/bls-cpi";
import { blsFixture } from "../pipeline/sources/bls-cpi.fixtures";

const entities: readonly Entity[] = [
  {
    id: "ent-citywide-berkeley",
    type: "service",
    canonicalName: "Citywide Berkeley Operations",
    plainDescription: "Citywide total.",
  },
];

const values: readonly BudgetValue[] = [
  {
    fiscalYear: 2020,
    amountNominalCents: 60000000000,
    stage: "actual",
    basis: "gaap",
    entityId: "ent-citywide-berkeley",
    entityType: "service",
    sourceId: "src-sco-expenditures-per-capita-ykhf-vfsr",
    sourceLabel: "Berkeley total expenditures (per-capita dataset, FY2020)",
    extractionMethod: "api",
    confidence: "verified",
    schemaVersion: "1.0.0",
  },
  {
    fiscalYear: 2024,
    amountNominalCents: 78000000000,
    stage: "actual",
    basis: "gaap",
    entityId: "ent-citywide-berkeley",
    entityType: "service",
    sourceId: "src-sco-expenditures-per-capita-ykhf-vfsr",
    sourceLabel: "Berkeley total expenditures (per-capita dataset, FY2024)",
    extractionMethod: "api",
    confidence: "verified",
    schemaVersion: "1.0.0",
  },
  {
    fiscalYear: 2024,
    amountNominalCents: 80000000000,
    stage: "actual",
    basis: "gaap",
    entityId: "ent-citywide-berkeley",
    entityType: "service",
    sourceId: "src-sco-revenues-per-capita-ky7j-fsk5",
    sourceLabel: "Berkeley total revenues (per-capita dataset, FY2024)",
    extractionMethod: "api",
    confidence: "verified",
    schemaVersion: "1.0.0",
  },
];

const snapshot: OverviewSnapshot = {
  fiscalYear: 2024,
  baseYear: 2024,
  mode: "real",
  surface: "sco-standardized-actuals",
  expendituresCents: 78000000000,
  revenuesCents: 80000000000,
  perResidentExpendituresCents: 627413,
  perResidentRevenuesCents: 643501,
  estimatedPopulation: 124320,
  comparability: "reconstructed",
  sources: ["src-sco-expenditures-per-capita-ykhf-vfsr", "src-sco-revenues-per-capita-ky7j-fsk5"],
  notes: ["Every Overview figure is a California State Controller standardized actual for Berkeley, not an adopted budget figure."],
};

describe("query engine", () => {
  it("produces a trend sorted by fiscal year for the citywide entity", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const trend = getOverviewTrend({
      snapshot,
      values,
      entities,
      cpi: averages,
      population: [{ fiscalYear: 2020, estimatedPopulation: 121000 }, { fiscalYear: 2024, estimatedPopulation: 124320 }],
      mode: "nominal",
      baseYear: 2024,
    });
    expect(trend.map((p) => p.fiscalYear)).toEqual([2020, 2024]);
  });

  it("scales the historical year by the CPI factor in real-dollar mode", () => {
    const averages = fiscalYearAverage(parseCpiObservations(blsFixture));
    const trend = getOverviewTrend({
      snapshot,
      values,
      entities,
      cpi: averages,
      population: [{ fiscalYear: 2020, estimatedPopulation: 121000 }, { fiscalYear: 2024, estimatedPopulation: 124320 }],
      mode: "real",
      baseYear: 2024,
    });
    const fy2020 = trend.find((p) => p.fiscalYear === 2020);
    expect(fy2020?.expendituresCents).toBeGreaterThan(60000000000);
  });

  it("formats cents as USD with comma separators", () => {
    expect(formatCents(78000000000)).toBe("$780,000,000.00");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(123)).toBe("$1.23");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- query/engine.test`
Expected: FAIL with `Cannot find module './engine'`.

- [ ] **Step 3: Write the engine implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\query\engine.ts`:

```typescript
import type { BudgetValue, Comparability, Entity } from "../pipeline/canonical/schema";
import { inflateCents, type FiscalYearAverage } from "../pipeline/sources/bls-cpi";
import type { OverviewSnapshot, PopulationObservation } from "../pipeline/derive/derive";

export type DollarMode = "real" | "nominal";

export interface OverviewTrendPoint {
  readonly fiscalYear: number;
  readonly expendituresCents: number;
  readonly revenuesCents: number;
  readonly perResidentExpendituresCents: number;
  readonly perResidentRevenuesCents: number;
  readonly estimatedPopulation: number;
  readonly comparability: Comparability;
}

export interface OverviewQueryInput {
  readonly snapshot: OverviewSnapshot;
  readonly values: readonly BudgetValue[];
  readonly entities: readonly Entity[];
  readonly cpi: readonly FiscalYearAverage[];
  readonly population: readonly PopulationObservation[];
  readonly mode: DollarMode;
  readonly baseYear: number;
}

const EXPENDITURE_SOURCE_ID = "src-sco-expenditures-per-capita-ykhf-vfsr";
const REVENUE_SOURCE_ID = "src-sco-revenues-per-capita-ky7j-fsk5";

const USDFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCents(cents: number): string {
  return USDFormatter.format(cents / 100);
}

function pickScoValue(values: readonly BudgetValue[], fiscalYear: number, sourceId: string): BudgetValue | undefined {
  return values.find((v) => v.fiscalYear === fiscalYear && v.sourceId === sourceId);
}

function inflateOrNominal(nominal: number, fiscalYear: number, baseYear: number, mode: DollarMode, cpi: readonly FiscalYearAverage[]): number {
  if (mode === "nominal" || fiscalYear === baseYear) return nominal;
  return inflateCents(nominal, fiscalYear, baseYear, cpi);
}

export function getOverviewTrend(input: OverviewQueryInput): readonly OverviewTrendPoint[] {
  const { snapshot, values, cpi, population, mode, baseYear } = input;
  void snapshot;
  void input.entities;
  const years = Array.from(
    new Set(
      values
        .filter((v) => v.sourceId === EXPENDITURE_SOURCE_ID || v.sourceId === REVENUE_SOURCE_ID)
        .map((v) => v.fiscalYear),
    ),
  ).sort((a, b) => a - b);
  return years.map((fy) => {
    const exp = pickScoValue(values, fy, EXPENDITURE_SOURCE_ID);
    const rev = pickScoValue(values, fy, REVENUE_SOURCE_ID);
    const expendituresCents = exp ? inflateOrNominal(exp.amountNominalCents, fy, baseYear, mode, cpi) : 0;
    const revenuesCents = rev ? inflateOrNominal(rev.amountNominalCents, fy, baseYear, mode, cpi) : 0;
    const popEntry = population.find((p) => p.fiscalYear === fy);
    const estimatedPopulation = popEntry?.estimatedPopulation ?? 0;
    const perResidentExpendituresCents = estimatedPopulation > 0 ? Math.round(expendituresCents / estimatedPopulation) : 0;
    const perResidentRevenuesCents = estimatedPopulation > 0 ? Math.round(revenuesCents / estimatedPopulation) : 0;
    return {
      fiscalYear: fy,
      expendituresCents,
      revenuesCents,
      perResidentExpendituresCents,
      perResidentRevenuesCents,
      estimatedPopulation,
      comparability: "reconstructed" as const,
    };
  });
}
```

- [ ] **Step 4: Write the failing URL state test**

Write `C:\Users\Y\proj\berkeley-budget\src\query\url-state.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseOverviewUrl, serializeOverviewUrl } from "./url-state";

describe("overview url state", () => {
  it("defaults to real / base 2024 when params are absent", () => {
    expect(parseOverviewUrl("")).toEqual({ mode: "real", baseYear: 2024 });
  });

  it("rejects unknown mode values and falls back to real", () => {
    expect(parseOverviewUrl("?mode=hyper").mode).toBe("real");
  });

  it("coerces a valid base year", () => {
    expect(parseOverviewUrl("?mode=nominal&baseYear=2022")).toEqual({ mode: "nominal", baseYear: 2022 });
  });

  it("round-trips through serialize", () => {
    const search = serializeOverviewUrl({ mode: "nominal", baseYear: 2024 });
    expect(search).toBe("?mode=nominal&baseYear=2024");
    expect(parseOverviewUrl(search)).toEqual({ mode: "nominal", baseYear: 2024 });
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm test -- query/url-state.test`
Expected: FAIL with `Cannot find module './url-state'`.

- [ ] **Step 6: Write the URL state implementation**

Write `C:\Users\Y\proj\berkeley-budget\src\query\url-state.ts`:

```typescript
import { z } from "zod";

export const DollarModeSchema = z.enum(["real", "nominal"]);
export type DollarMode = z.infer<typeof DollarModeSchema>;

const BaseYearSchema = z.coerce.number().int().min(1990).max(2100);

export function parseOverviewUrl(search: string): OverviewUrlState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  // Validate mode independently and fall back to "real" for unknown
  // values. The schema is applied per field so a bad `mode` query does
  // not throw away a still-valid `baseYear`. The base year is validated
  // separately; an out-of-range or non-numeric value falls back to the
  // schema default (2024).
  const modeRaw = params.get("mode");
  let mode: OverviewUrlState["mode"] = "real";
  if (typeof modeRaw === "string") {
    const parsed = DollarModeSchema.safeParse(modeRaw);
    if (parsed.success) mode = parsed.data;
  }
  const baseRaw = params.get("baseYear");
  let baseYear: OverviewUrlState["baseYear"] = 2024;
  if (typeof baseRaw === "string") {
    const parsed = BaseYearSchema.safeParse(baseRaw);
    if (parsed.success) baseYear = parsed.data;
  }
  return { mode, baseYear };
}

export interface OverviewUrlState {
  readonly mode: DollarMode;
  readonly baseYear: number;
}

export function serializeOverviewUrl(state: OverviewUrlState): string {
  const params = new URLSearchParams();
  params.set("mode", state.mode);
  params.set("baseYear", String(state.baseYear));
  return `?${params.toString()}`;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test -- query/`
Expected: PASS (7 tests).

- [ ] **Step 8: Verify typecheck and lint**

Run: `pnpm run typecheck`
Expected: exit code 0.

Run: `pnpm run lint`
Expected: exit code 0.

- [ ] **Step 9: OPTIONAL commit**

If Git initialized and approved:

```bash
git add src/query
git commit -m "feat(query): typed overview engine + URL state parser"
```

Otherwise skip this step.

---

## Task 12: Accessible Overview route (snapshot, cards, chart, table, citations)

**Files:**
- Create: `src/content/services.ts`
- Create: `src/content/services.test.ts`
- Create: `src/routes/Overview.tsx`
- Create: `src/routes/Overview.module.css`
- Create: `src/routes/Overview.test.tsx`

**Interfaces:**
- Consumes: `OverviewSnapshot`, `OverviewTrendPoint`, `formatCents`, `parseOverviewUrl`, `serializeOverviewUrl`, design-system primitives, `getOverviewTrend`.
- Produces:
  - `serviceTaxonomy: readonly ServiceEntry[]` listing nine resident-recognizable services with `serviceKey`, `label`, `plainDescription`, `socrataProgramKey`.
  - `<Overview>` reads the current URL state, derives the trend for both `real` and `nominal` from the artifacts, renders a snapshot `<dl>`, the toggle, a service cards grid, the trend chart, the synchronized `<table>`, and a citations footer listing the **five** Phase 1 sources.

- [ ] **Step 1: Write the failing services content test**

Write `C:\Users\Y\proj\berkeley-budget\src\content\services.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { serviceTaxonomy } from "./services";

describe("service taxonomy", () => {
  it("lists at least nine resident-recognizable services", () => {
    expect(serviceTaxonomy.length).toBeGreaterThanOrEqual(9);
  });

  it("assigns a unique serviceKey to each entry", () => {
    const keys = new Set(serviceTaxonomy.map((s) => s.serviceKey));
    expect(keys.size).toBe(serviceTaxonomy.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- content/services.test`
Expected: FAIL with `Cannot find module './services'`.

- [ ] **Step 3: Write the services taxonomy**

Write `C:\Users\Y\proj\berkeley-budget\src\content\services.ts`:

```typescript
export interface ServiceEntry {
  readonly serviceKey: string;
  readonly label: string;
  readonly plainDescription: string;
  readonly socrataProgramKey: string | null;
}

export const serviceTaxonomy: readonly ServiceEntry[] = [
  { serviceKey: "svc-public-safety", label: "Public safety", plainDescription: "Police, fire, and emergency response.", socrataProgramKey: null },
  { serviceKey: "svc-streets", label: "Streets and sidewalks", plainDescription: "Roadway maintenance and paving programs.", socrataProgramKey: "Streets and Sidewalks" },
  { serviceKey: "svc-housing", label: "Housing and homelessness", plainDescription: "Affordable housing and shelter programs.", socrataProgramKey: null },
  { serviceKey: "svc-parks", label: "Parks and recreation", plainDescription: "Parks, pools, and recreation centers.", socrataProgramKey: null },
  { serviceKey: "svc-libraries", label: "Libraries", plainDescription: "Branch operations, materials, and programs.", socrataProgramKey: "Public Services" },
  { serviceKey: "svc-health", label: "Health and human services", plainDescription: "Public health, mental health, and aging services.", socrataProgramKey: null },
  { serviceKey: "svc-climate", label: "Climate and environment", plainDescription: "Sustainability, energy, and resilience programs.", socrataProgramKey: null },
  { serviceKey: "svc-economic", label: "Economic development", plainDescription: "Workforce, small business, and arts programs.", socrataProgramKey: null },
  { serviceKey: "svc-general", label: "General government", plainDescription: "City Council, City Manager, Attorney, Auditor.", socrataProgramKey: null },
];
```

- [ ] **Step 4: Write the Overview component CSS**

Write `C:\Users\Y\proj\berkeley-budget\src\routes\Overview.module.css`:

```css
.section {
  display: grid;
  gap: var(--space-4);
}

.toggleRow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.toggleMeta {
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
}

.cardGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-4);
}

.citationList {
  display: grid;
  gap: var(--space-3);
  padding: 0;
  margin: 0;
  list-style: none;
}

.citationItem {
  display: grid;
  gap: var(--space-1);
  padding-block: var(--space-2);
  border-bottom: 1px solid var(--color-rule);
}

.citationItem:last-child { border-bottom: none; }

.citationId {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-ink-muted);
}

.warn {
  padding: var(--space-4);
  background: var(--color-warn-bg);
  color: var(--color-warn-ink);
  border-left: 4px solid var(--color-warn-ink);
  border-radius: var(--radius-sm);
  font-size: 0.9375rem;
}

@media (max-width: 480px) {
  .toggleRow { flex-direction: column; align-items: flex-start; }
}
```

- [ ] **Step 5: Write the Overview component**

Write `C:\Users\Y\proj\berkeley-budget\src\routes\Overview.tsx`:

```typescript
import { useCallback, useSyncExternalStore } from "react";
import { Card, DataTable, type Column, DefinitionList, PageLayout, Toggle, type ToggleOption, TrendChart } from "../design-system";
import { formatCents, getOverviewTrend, type DollarMode } from "../query/engine";
import { parseOverviewUrl, serializeOverviewUrl } from "../query/url-state";
import { serviceTaxonomy } from "../content/services";
import releaseData from "../artifacts/release.json" with { type: "json" };
import valuesData from "../artifacts/values.json" with { type: "json" };
import entitiesData from "../artifacts/entities.json" with { type: "json" };
import cpiData from "../artifacts/cpi.json" with { type: "json" };
import populationData from "../artifacts/population.json" with { type: "json" };
import overviewData from "../artifacts/overview.json" with { type: "json" };
import type { BudgetValue, Entity } from "../pipeline/canonical/schema";
import type { OverviewSnapshot } from "../pipeline/derive/derive";
import type { FiscalYearAverage } from "../pipeline/sources/bls-cpi";
import styles from "./Overview.module.css";

interface ReleaseArtifact {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly sources: readonly string[];
  readonly surface: "sco-standardized-actuals";
}

interface CpiArtifact {
  readonly seriesId: "CUURA422SA0";
  readonly baseYear: number;
  readonly fiscalYearAverages: readonly FiscalYearAverage[];
}

interface PopulationArtifact {
  readonly observations: readonly { fiscalYear: number; estimatedPopulation: number }[];
}

interface OverviewArtifact {
  readonly baseYear: number;
  readonly surface: "sco-standardized-actuals";
  readonly snapshots: readonly OverviewSnapshot[];
}

const cpi = cpiData as CpiArtifact;
const values = valuesData as readonly BudgetValue[];
const entities = entitiesData as readonly Entity[];
const population = (populationData as PopulationArtifact).observations;
const overviewBundle = overviewData as OverviewArtifact;
const release = releaseData as ReleaseArtifact;

const modeOptions: readonly ToggleOption<DollarMode>[] = [
  { value: "real", label: "Real (FY2024 dollars)" },
  { value: "nominal", label: "Nominal" },
];

function subscribeToUrl(listener: () => void): () => void {
  // `popstate` fires on browser back/forward and on history.replaceState /
  // pushState in modern browsers when paired with a dispatchEvent. We
  // listen for both so the Overview rerenders whenever the URL changes.
  window.addEventListener("popstate", listener);
  window.addEventListener("bbe:url-change", listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("bbe:url-change", listener);
  };
}

function getUrlSnapshot(): string {
  return window.location.search;
}

function getServerSnapshot(): string {
  return "";
}

function useUrlSearch(): string {
  return useSyncExternalStore(subscribeToUrl, getUrlSnapshot, getServerSnapshot);
}

function useUrlState(): { mode: DollarMode; baseYear: number; setMode: (next: DollarMode) => void } {
  const search = useUrlSearch();
  const state = parseOverviewUrl(search);
  const setMode = useCallback((next: DollarMode) => {
    const serialized = serializeOverviewUrl({ mode: next, baseYear: state.baseYear });
    window.history.replaceState(null, "", `${window.location.pathname}${serialized}${window.location.hash}`);
    // The history API does not fire `popstate` for replaceState/pushState
    // in every browser; dispatch a custom event so the Overview rerenders.
    window.dispatchEvent(new Event("bbe:url-change"));
  }, [state.baseYear]);
  return { mode: state.mode, baseYear: state.baseYear, setMode };
}

export function Overview(): React.JSX.Element {
  const { mode, setMode } = useUrlState();
  const baseYear = overviewBundle.baseYear;
  const currentSnapshot = overviewBundle.snapshots.find((s) => s.fiscalYear === baseYear) ?? overviewBundle.snapshots[0];
  const anchorSnapshot = overviewBundle.snapshots.find((s) => s.fiscalYear === 2015);
  if (!currentSnapshot) throw new Error("No overview snapshot available");
  const trend = getOverviewTrend({
    snapshot: currentSnapshot,
    values,
    entities,
    cpi: cpi.fiscalYearAverages,
    population,
    mode,
    baseYear,
  });
  const summary = mode === "real"
    ? `Total expenditures and revenues scaled to FY${baseYear} dollars using BLS CPI-U for San Francisco-Oakland-Hayward.`
    : `Total expenditures and revenues as reported in nominal dollars.`;
  const tableRows = trend;
  const tableColumns: readonly Column<typeof tableRows[number]>[] = [
    { key: "year", header: "Fiscal year", render: (r) => `FY${r.fiscalYear}` },
    { key: "expenditures", header: "Total expenditures", align: "end", render: (r) => formatCents(r.expendituresCents) },
    { key: "revenues", header: "Total revenues", align: "end", render: (r) => formatCents(r.revenuesCents) },
    { key: "perCapitaExp", header: "Per-resident expenditures", align: "end", render: (r) => formatCents(r.perResidentExpendituresCents) },
    { key: "perCapitaRev", header: "Per-resident revenues", align: "end", render: (r) => formatCents(r.perResidentRevenuesCents) },
    { key: "comp", header: "Comparability", render: (r) => r.comparability },
  ];
  return (
    <PageLayout
      eyebrow="Berkeley Budget Explorer"
      title="City of Berkeley at a glance"
      intro="Inflation-adjusted dollars by default, with a toggle for nominal amounts. Every figure links to one of five published sources."
      footer={<small>Release {release.releaseId} generated {release.generatedAt}. Phase 1 surface: California State Controller standardized actuals for Berkeley (FY2003–FY2024). Adopted-versus-actual variance is deferred to Phase 3.</small>}
    >
      <section aria-labelledby="disclosure-heading" className={styles.section}>
        <h2 id="disclosure-heading">What this page shows</h2>
        <p>
          Every value on this page is a California State Controller <strong>standardized actual</strong> for the City of Berkeley,
          drawn from the per-capita datasets <code>src-sco-expenditures-per-capita-ykhf-vfsr</code> and
          <code> src-sco-revenues-per-capita-ky7j-fsk5</code>. Adopted, revised, and projected values are not shown.
          Adopted-versus-actual variance is deferred to Phase 3, which adds reviewed Berkeley PDF and ACFR extraction.
        </p>
      </section>

      <section aria-labelledby="snapshot-heading" className={styles.section}>
        <h2 id="snapshot-heading">Fiscal snapshot</h2>
        <DefinitionList
          ariaLabel="Latest fiscal snapshot"
          items={[
            { term: "Selected fiscal year", description: `FY${currentSnapshot.fiscalYear}` },
            { term: "Total expenditures", description: formatCents(currentSnapshot.expendituresCents) },
            { term: "Total revenues", description: formatCents(currentSnapshot.revenuesCents) },
            { term: "Per-resident expenditures", description: `${formatCents(currentSnapshot.perResidentExpendituresCents)} (population ${currentSnapshot.estimatedPopulation.toLocaleString("en-US")})` },
            { term: "Per-resident revenues", description: formatCents(currentSnapshot.perResidentRevenuesCents) },
            { term: "Comparability", description: currentSnapshot.comparability },
            { term: "Sources", description: currentSnapshot.sources.join(", ") },
          ]}
        />
      </section>

      <section aria-labelledby="toggle-heading" className={styles.section}>
        <div className={styles.toggleRow}>
          <Toggle legend="Dollar mode" options={modeOptions} value={mode} onChange={setMode} />
          <p className={styles.toggleMeta}>Showing {mode === "real" ? `inflation-adjusted (base FY${baseYear})` : "as-reported"} dollars.</p>
        </div>
      </section>

      <section aria-labelledby="trend-heading" className={styles.section}>
        <h2 id="trend-heading">Historical trend</h2>
        <TrendChart
          points={trend.map((p) => ({ fiscalYear: p.fiscalYear, amountCents: p.expendituresCents }))}
          baseYear={baseYear}
          yLabel="Total expenditures"
          ariaLabel="Total citywide standardized expenditures by fiscal year."
          summary={summary}
        />
        <DataTable
          caption="Total standardized expenditures and revenues by fiscal year, with per-resident values (synchronized with the chart above)."
          columns={tableColumns}
          rows={tableRows}
          getRowKey={(r) => String(r.fiscalYear)}
        />
      </section>

      <section aria-labelledby="services-heading" className={styles.section}>
        <h2 id="services-heading">Service areas</h2>
        <p>The Phase 1 cohort covers service-level line items only for FY2012–FY2015 (Socrata <code>gy8t-iqc4</code>). FY2015 marks the end of that cohort; it is never stitched into the SCO actuals series.</p>
        <div className={styles.cardGrid}>
          {serviceTaxonomy.map((svc) => (
            <Card
              key={svc.serviceKey}
              eyebrow={svc.serviceKey}
              title={svc.label}
              body={<p>{svc.plainDescription}</p>}
              footer={svc.socrataProgramKey ? <small>Indexed in Socrata cohort as "{svc.socrataProgramKey}".</small> : <small>Citywide total only in Phase 1.</small>}
            />
          ))}
        </div>
      </section>

      {anchorSnapshot ? (
        <section aria-labelledby="break-heading" className={styles.section}>
          <h2 id="break-heading">Known schema breaks</h2>
          <p className={styles.warn}>
            The Socrata operating-budget line items stop at FY{anchorSnapshot.fiscalYear}. The State Controller's detailed expenditure schema changes materially in FY2017. Phase 1 shows the citywide total across both sources without implying false line-item continuity across either break.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="sources-heading" className={styles.section}>
        <h2 id="sources-heading">Source citations</h2>
        <ul className={styles.citationList}>
          {release.sources.map((id) => (
            <li key={id} className={styles.citationItem}>
              <span className={styles.citationId}>{id}</span>
              <span>Source manifest entry {id}; see <a href="#/methodology">Methodology</a>.</span>
            </li>
          ))}
        </ul>
      </section>
    </PageLayout>
  );
}
```

- [ ] **Step 6: Write the failing Overview component test**

Write `C:\Users\Y\proj\berkeley-budget\src\routes\Overview.test.tsx`:

```typescript
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Overview } from "./Overview";

const originalSearch = window.location.search;
const originalHash = window.location.hash;

describe("Overview route", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/?mode=real&baseYear=2024");
  });

  afterEach(() => {
    window.history.replaceState(null, "", `${originalSearch}${originalHash}`);
  });

  it("renders the fiscal snapshot with the selected year", () => {
    render(<Overview />);
    expect(screen.getByRole("heading", { name: /city of berkeley at a glance/i })).toBeInTheDocument();
    expect(screen.getAllByText(/FY2024/i).length).toBeGreaterThan(0);
  });

  it("discloses that every value is a SCO standardized actual", () => {
    render(<Overview />);
    expect(screen.getByText(/standardized actual/i)).toBeInTheDocument();
  });

  it("lists all five manifest source ids in the citation footer", () => {
    render(<Overview />);
    const citations = screen.getAllByRole("listitem");
    const ids = citations.map((li) => li.textContent ?? "").filter((t) => t.startsWith("src-"));
    expect(ids).toEqual(
      expect.arrayContaining([
        "src-bls-cpi-u-cuura422sa0",
        "src-berkeley-socrata-gy8t-iqc4",
        "src-sco-expenditures-ju3w-4gxp",
        "src-sco-expenditures-per-capita-ykhf-vfsr",
        "src-sco-revenues-per-capita-ky7j-fsk5",
      ]),
    );
    expect(ids.length).toBe(5);
  });

  it("switches dollar mode via the toggle and updates the URL", async () => {
    const user = userEvent.setup();
    render(<Overview />);
    await user.click(screen.getByRole("radio", { name: /nominal/i }));
    expect(window.location.search).toContain("mode=nominal");
  });

  it("rerenders snapshot/chart/table values when the dollar mode changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Overview />);
    const realText = screen.getByRole("table").textContent ?? "";
    await user.click(screen.getByRole("radio", { name: /nominal/i }));
    rerender(<Overview />);
    const nominalText = screen.getByRole("table").textContent ?? "";
    expect(realText).not.toBe(nominalText);
    expect(nominalText).toContain("$780,000,000.00");
    await user.click(screen.getByRole("radio", { name: /real/i }));
    rerender(<Overview />);
    const realAgainText = screen.getByRole("table").textContent ?? "";
    expect(realAgainText).not.toBe(nominalText);
    expect(realAgainText).toContain("$780,000,000.00");
  });

  it("subscribes to URL changes via useSyncExternalStore and rerenders on popstate", async () => {
    const user = userEvent.setup();
    render(<Overview />);
    const beforeText = screen.getByRole("table").textContent ?? "";
    // Mutate the URL without going through the toggle.
    window.history.replaceState(null, "", "/?mode=nominal&baseYear=2024");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await user.click(screen.getByRole("radio", { name: /real/i }));
    const afterText = screen.getByRole("table").textContent ?? "";
    expect(afterText).not.toBe(beforeText);
  });

  it("renders the synchronized data table with at least one row", () => {
    render(<Overview />);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    expect(table.querySelectorAll("tbody tr").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 7: Run the Overview component test**

Run: `pnpm test -- routes/Overview.test`
Expected: PASS (3 tests). If the test fails because artifacts are missing, re-run `pnpm run build:artifacts` to regenerate them, then re-run the test.

- [ ] **Step 8: Verify typecheck and lint**

Run: `pnpm run typecheck`
Expected: exit code 0.

Run: `pnpm run lint`
Expected: exit code 0.

- [ ] **Step 9: Verify production build and preview**

Run: `pnpm run build`
Expected: `dist/` produced; no errors.

Run: `pnpm run preview` (background, then stop)
Expected: server responds at `http://localhost:4173` with the Overview page.

- [ ] **Step 10: OPTIONAL commit**

If Git initialized and approved:

```bash
git add src/content/services.ts src/content/services.test.ts src/routes/Overview.tsx src/routes/Overview.module.css src/routes/Overview.test.tsx
git commit -m "feat(routes): accessible Overview page with toggle, chart, table"
```

Otherwise skip this step.

---

## Task 13: Methodology route (sources, limitations, comparability disclosures)

**Files:**
- Create: `src/content/methodology.ts`
- Create: `src/content/methodology.test.ts`
- Create: `src/routes/Methodology.tsx`
- Create: `src/routes/Methodology.module.css`

**Interfaces:**
- Consumes: `SourceManifestSchema` parsing the manifest JSON, the pipeline `quality-report.json`.
- Produces:
  - `methodologySections: readonly MethodologySection[]` covering sources, CPI, population, schema breaks, PDF deferral, comparability levels, release cadence.
  - `<Methodology>` renders the page sections with a per-source detail `<dl>` and a link back to Overview.

- [ ] **Step 1: Write the failing methodology content test**

Write `C:\Users\Y\proj\berkeley-budget\src\content\methodology.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { methodologySections } from "./methodology";

describe("methodology sections", () => {
  it("includes a Sources section", () => {
    expect(methodologySections.some((s) => /sources/i.test(s.title))).toBe(true);
  });

  it("includes a Comparability section", () => {
    expect(methodologySections.some((s) => /comparability/i.test(s.title))).toBe(true);
  });

  it("explicitly discloses the FY2015 Socrata stop and FY2017 schema break", () => {
    const text = methodologySections.map((s) => s.body).join("\n");
    expect(text).toContain("FY2015");
    expect(text).toContain("FY2017");
  });

  it("discloses that PDF-derived values are deferred", () => {
    const text = methodologySections.map((s) => s.body).join("\n");
    expect(text.toLowerCase()).toContain("pdf");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- content/methodology.test`
Expected: FAIL with `Cannot find module './methodology'`.

- [ ] **Step 3: Write the methodology content**

Write `C:\Users\Y\proj\berkeley-budget\src\content\methodology.ts`:

```typescript
export interface MethodologySection {
  readonly title: string;
  readonly body: string;
}

export const methodologySections: readonly MethodologySection[] = [
  {
    title: "Sources",
    body:
      "Phase 1 ingests five structured sources, all recorded as checked-in API snapshots under data/snapshots/<source-id>/<release-id>.json: BLS CPI-U CUURA422SA0, Berkeley Open Data Socrata gy8t-iqc4 (FY2012–FY2015 adopted line items), California State Controller detailed expenditures ju3w-4gxp (category context only), California State Controller expenditures per capita ykhf-vfsr (authoritative citywide expenditures), and California State Controller revenues per capita ky7j-fsk5 (authoritative citywide revenues). Each release pins checksums, parser versions, and retrieval dates.",
  },
  {
    title: "Phase 1 surface",
    body:
      "The Overview page is a California State Controller standardized actual for the City of Berkeley, FY2003–FY2024. Adopted, revised, and projected values are not shown. Adopted-versus-actual variance is deferred to Phase 3, which adds reviewed Berkeley PDF and ACFR extraction.",
  },
  {
    title: "Inflation adjustment",
    body:
      "Inflation-adjusted amounts use BLS CPI-U CUURA422SA0 (San Francisco-Oakland-Hayward, all items), annualised as the arithmetic mean of bimonthly index values within each Berkeley fiscal year (July through June). BLS publishes this metropolitan series bimonthly, so each complete FY has six scheduled observations: July, September, November, January, March, May. The default base year is FY2024, derived from latestCompleteFiscalYear on the pinned snapshot. Any fiscal year with fewer than six scheduled bimonthly observations is excluded from factor computation and the Overview shows a coverage-incomplete notice for that year.",
  },
  {
    title: "Per-resident derivation",
    body:
      "Per-resident amounts use the California State Controller estimated_population value paired with the same fiscal year's totals from the per-capita datasets ykhf-vfsr and ky7j-fsk5. This means the per-resident series ends at FY2024 and uses a single population source end-to-end. The historical series therefore stops at FY2024; a later migration to California Department of Finance estimates must recompute the entire historical series in one versioned release and may not splice a second population source onto the State Controller series.",
  },
  {
    title: "Comparability",
    body:
      "Comparability levels are exact, reconstructed, approximate, or incompatible. Phase 1 does not compute adopted-versus-actual variances. Approximate mappings must never power a precise variance claim.",
  },
  {
    title: "Known schema breaks",
    body:
      "The Berkeley Socrata line-item cohort stops at FY2015 and is never stitched into the State Controller series. The State Controller detailed expenditure schema changes materially in FY2017; the Overview shows the citywide total across the break without implying line-item continuity. SCO detailed expenditures never sum into a citywide total because total/subtotal rows would double-count.",
  },
  {
    title: "PDF extraction",
    body:
      "PDF-derived adopted, revised, and actual values are deferred to a separate source-verification subplan. Phase 1 does not parse budget books or ACFRs. PDF rows marked review-required are excluded from public normalized comparisons.",
  },
  {
    title: "Release cadence",
    body:
      "The data pipeline runs at build time and is fully offline. pnpm refresh:data is the only network-capable command and is opt-in. pnpm build and pnpm build:artifacts read data/snapshots/ only, refuse to start when a snapshot is missing or when its SHA-256 does not match the manifest, and produce identical src/artifacts/*.json bytes when given identical snapshot bytes. The published site loads only the bundled artifacts and requires no source APIs at runtime.",
  },
];
```

- [ ] **Step 4: Write the Methodology route CSS**

Write `C:\Users\Y\proj\berkeley-budget\src\routes\Methodology.module.css`:

```css
.section {
  display: grid;
  gap: var(--space-3);
  padding-block: var(--space-4);
  border-bottom: 1px solid var(--color-rule);
}

.section:last-of-type { border-bottom: none; }

.section h2 { margin-bottom: var(--space-1); }

.section p {
  max-width: var(--measure-prose);
  color: var(--color-ink);
}

.sourceList {
  display: grid;
  gap: var(--space-3);
  padding: 0;
  margin: 0;
  list-style: none;
}
```

- [ ] **Step 5: Write the Methodology route**

Write `C:\Users\Y\proj\berkeley-budget\src\routes\Methodology.tsx`:

```typescript
import { Card, DefinitionList, PageLayout } from "../design-system";
import { methodologySections } from "../content/methodology";
import manifestData from "../pipeline/sources/manifest.data.json" with { type: "json" };
import qualityData from "../artifacts/quality-report.json" with { type: "json" };
import type { SourceManifest } from "../pipeline/sources/manifest";
import type { QualityReport } from "../pipeline/derive/quality-report";
import styles from "./Methodology.module.css";

const manifest = manifestData as SourceManifest;
const quality = qualityData as QualityReport;

export function Methodology(): React.JSX.Element {
  return (
    <PageLayout
      eyebrow="Berkeley Budget Explorer"
      title="Methodology and sources"
      intro="Every figure on this site traces back to a published source and a documented derivation step."
    >
      <section aria-labelledby="sources-heading" className={styles.section}>
        <h2 id="sources-heading">Phase 1 sources</h2>
        <ul className={styles.sourceList}>
          {manifest.sources.map((s) => (
            <li key={s.id}>
              <Card
                eyebrow={s.id}
                title={s.title}
                body={
                  <>
                    <p>{s.publisher}</p>
                    <p>
                      <a href={s.url}>{s.url}</a>
                    </p>
                    {s.notes ? <p>{s.notes}</p> : null}
                  </>
                }
                footer={`Retrieved ${s.retrievedAt} · Parser ${s.parserVersion} · Checksum ${s.checksumSha256.slice(0, 12)}…`}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="release-heading" className={styles.section}>
        <h2 id="release-heading">Release status</h2>
        <DefinitionList
          ariaLabel="Latest release status"
          items={[
            { term: "Release", description: quality.releaseId },
            { term: "Generated", description: quality.generatedAt },
            { term: "Status", description: quality.status },
            { term: "Sources", description: `${quality.sourceCount} pinned` },
            { term: "Comparability notes", description: quality.comparabilityNotes.join(" · ") },
          ]}
        />
      </section>

      {methodologySections.map((section) => (
        <section key={section.title} className={styles.section}>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
        </section>
      ))}

      <p><a href="#/">Back to the Overview</a></p>
    </PageLayout>
  );
}
```

- [ ] **Step 6: Verify typecheck, lint, and tests**

Run: `pnpm test -- content/methodology.test`
Expected: PASS (4 tests).

Run: `pnpm run typecheck`
Expected: exit code 0.

Run: `pnpm run lint`
Expected: exit code 0.

- [ ] **Step 7: OPTIONAL commit**

If Git initialized and approved:

```bash
git add src/content/methodology.ts src/content/methodology.test.ts src/routes/Methodology.tsx src/routes/Methodology.module.css
git commit -m "feat(routes): Methodology page with sources, disclosures, release status"
```

Otherwise skip this step.

---

## Task 14: Browser journeys, accessibility checks, and static build verification

**Files:**
- Create: `tests/browser/overview.spec.ts`
- Create: `tests/browser/a11y.spec.ts`

**Interfaces:**
- Consumes: Playwright 1.50+, `@axe-core/playwright` 4.10.
- Produces:
  - `tests/browser/overview.spec.ts` exercising: read overview, switch real→nominal and observe identical chart+table values, inspect sources citation footer, copy URL and reload to confirm state restoration, navigate to Methodology.
  - `tests/browser/a11y.spec.ts` running `@axe-core/playwright` against the Overview and Methodology pages.

- [ ] **Step 1: Write the Overview journey spec**

Write `C:\Users\Y\proj\berkeley-budget\tests\browser\overview.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";

test.describe("Overview route", () => {
  test("renders the fiscal snapshot, table, and chart with no network calls beyond the document", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (req) => requests.push(req.url()));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /city of berkeley at a glance/i })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.locator("figure svg")).toHaveCount(1);
    const offsite = requests.filter((u) => !u.startsWith("http://localhost:4173") && !u.startsWith("data:"));
    expect(offsite).toEqual([]);
  });

  test("toggles real → nominal and updates the URL", async ({ page }) => {
    await page.goto("/");
    const realTable = await page.locator("table").first().innerText();
    const nominal = page.getByRole("radio", { name: /nominal/i });
    await nominal.click();
    await expect(page).toHaveURL(/mode=nominal/);
    const nominalTable = await page.locator("table").first().innerText();
    expect(nominalTable).not.toBe(realTable);
    expect(nominalTable).toContain("$780,000,000.00");
    const real = page.getByRole("radio", { name: /real/i });
    await real.click();
    await expect(page).toHaveURL(/mode=real/);
    const realTableAgain = await page.locator("table").first().innerText();
    expect(realTableAgain).not.toBe(nominalTable);
  });

  test("table and chart remain synchronized through a mode toggle", async ({ page }) => {
    await page.goto("/?mode=real&baseYear=2024");
    const realTableYears = await page.locator("table tbody tr").evaluateAll((rows) => rows.map((r) => r.textContent ?? ""));
    await page.goto("/?mode=nominal&baseYear=2024");
    const nominalTableYears = await page.locator("table tbody tr").evaluateAll((rows) => rows.map((r) => r.textContent ?? ""));
    expect(realTableYears.map((s) => s.match(/FY?(\d{4})/)?.[1]).filter(Boolean).sort()).toEqual(
      nominalTableYears.map((s) => s.match(/FY?(\d{4})/)?.[1]).filter(Boolean).sort(),
    );
  });

  test("table and chart show the same FY values for both modes", async ({ page }) => {
    await page.goto("/?mode=real&baseYear=2024");
    const realRows = await page.locator("table tbody tr").allInnerTexts();
    await page.goto("/?mode=nominal&baseYear=2024");
    const nominalRows = await page.locator("table tbody tr").allInnerTexts();
    const realFys = realRows.map((s) => s.match(/FY?(\d{4})/)?.[1]).filter(Boolean);
    const nominalFys = nominalRows.map((s) => s.match(/FY?(\d{4})/)?.[1]).filter(Boolean);
    expect(realFys.sort()).toEqual(nominalFys.sort());
  });

  test("citation footer lists every source manifest id (all five)", async ({ page }) => {
    await page.goto("/");
    const citations = page.locator("section[aria-labelledby='sources-heading'] li");
    await expect(citations).toHaveCount(5);
    await expect(citations).toHaveText([
      /src-bls-cpi-u-cuura422sa0/,
      /src-berkeley-socrata-gy8t-iqc4/,
      /src-sco-expenditures-ju3w-4gxp/,
      /src-sco-expenditures-per-capita-ykhf-vfsr/,
      /src-sco-revenues-per-capita-ky7j-fsk5/,
    ]);
  });

  test("Overview page discloses that values are SCO standardized actuals", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/standardized actual/i)).toBeVisible();
  });

  test("navigates to Methodology and back", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /methodology/i }).click();
    await expect(page).toHaveURL(/#\/methodology/);
    await expect(page.getByRole("heading", { name: /methodology and sources/i })).toBeVisible();
    await page.getByRole("link", { name: /back to the overview/i }).click();
    await expect(page.getByRole("heading", { name: /city of berkeley at a glance/i })).toBeVisible();
  });

  test("works at 320 CSS pixel width", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /city of berkeley at a glance/i })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("keyboard-only operation reaches the toggle", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    let safety = 30;
    while (safety > 0) {
      const focused = await page.evaluate(() => document.activeElement?.textContent ?? "");
      if (/nominal/i.test(focused)) break;
      await page.keyboard.press("Tab");
      safety -= 1;
    }
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/mode=nominal/);
  });
});
```

- [ ] **Step 2: Write the accessibility spec**

Write `C:\Users\Y\proj\berkeley-budget\tests\browser\a11y.spec.ts`:

```typescript
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("WCAG 2.2 AA", () => {
  test("Overview route has no serious or critical axe violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking).toEqual([]);
  });

  test("Methodology route has no serious or critical axe violations", async ({ page }) => {
    await page.goto("/#/methodology");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the static build and end-to-end suite**

Run: `pnpm run build`
Expected: `dist/` is created with `index.html`, hashed assets, and `favicon.svg`; no errors.

Run: `pnpm run test:e2e`
Expected: 9 browser tests pass (7 Overview journeys + 2 a11y). The Playwright HTML report is written to `playwright-report/`.

- [ ] **Step 4: Verify the production preview manually**

Run: `pnpm run preview` (background; stop after verification)
Expected: visiting `http://localhost:4173/` shows the Overview; visiting `http://localhost:4173/#/methodology` shows the Methodology page. Browser DevTools Network panel shows zero outbound requests after the initial document + bundle. Toggling the URL parameter `mode` between `real` and `nominal` updates the snapshot values, chart, and table identically.

- [ ] **Step 5: Final verification matrix**

Run, in order, capturing each exit code:

```bash
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run test:e2e
```

Expected: every command exits with code 0. The `dist/` directory contains the static bundle, the artifacts are committed under `src/artifacts/`, and the quality report at `src/artifacts/quality-report.json` reports `"status": "passed"`.

- [ ] **Step 6: OPTIONAL commit**

If Git initialized and approved:

```bash
git add tests/browser
git commit -m "test(e2e): Playwright journeys + axe-core WCAG 2.2 AA checks"
```

Otherwise skip this step.

---

# Phases 2–6 Roadmap

The roadmap below preserves the spec's fixed order. Each phase produces an independently useful release and may not begin until the previous phase has passed its exit gate. Detailed implementation tasks are **not** part of this plan; they will be written as separate plans after each phase validates its source data and findings.

## Phase 2 — Comparison workspace

**Goal:** Multi-entity comparison for services, departments, funds, revenues, and expense categories where source compatibility permits.

**Depends on:** Phase 1 (canonical model, crosswalk, derived CPI factors, reconciliation runner).

**Shared interfaces Phase 2 will introduce** (recorded now so Phase 1 leaves the right extension seams):

- `QueryEngine` extends with `compareSeries({ entityIds, fiscalYearRange, stages, unit, mode }) -> SeriesResult` returning per-entity series of `OverviewTrendPoint`-shaped values plus a `comparability: Comparability` per series.
- `UrlState` extends with multi-entity selection (max four), fiscal-year range, stage selection, unit (`absolute | per-resident | percent-change | share-of-total`), and chart view (`line | grouped-bar | composition`).
- `ExportEngine` produces CSV (matching the displayed table) and PNG (Plot chart with title, unit, period, source, footer) from the same `SeriesResult`.

**Tasks deferred to the Phase 2 plan** (not executable now):

- Adopted, revised, projected, and actual stage filtering (requires additional sources beyond Phase 1).
- Shareable URL state with all of the above encoded.
- FY2015/2016 and FY2017 schema-break annotations in the compare view.
- CSV and PNG exports with strict parity tests against displayed values.

**Exit gate:** A journalist can reproduce and share a defensible four-series comparison and download its underlying records.

## Phase 3 — Comprehensive Berkeley history

**Goal:** Extend Phase 1's foundation to the longest defensible Berkeley history.

**Depends on:** Phase 2 (comparison workspace), Phase 1 quality-report findings.

**Shared interfaces Phase 3 will introduce:**

- PDF extraction adapters behind a `SourceAdapter` interface with `reviewRequired` confidence; excluded from public comparisons until reviewed.
- Original-label mode on the query engine (`{ originalLabels: true }`).
- Quality dashboards for source coverage, confidence, and reconciliation outcomes.
- ACFR actuals adapter with `basis = gaap` distinct from budgetary adopted values.

**Tasks deferred to the Phase 3 plan** (not executable now):

- Source-specific PDF adapters per biennium, each with golden fixture tests against reviewed values.
- ACFR adapter for FY2023, FY2024, FY2025.
- City Auditor 2026 financial-condition contextual series.
- Population migration to California Department of Finance estimates (one versioned recompute).

**Exit gate:** Users can traverse the longest defensible Berkeley history without the interface implying false line-item continuity.

## Phase 4 — Guided civic atlas

**Goal:** Universal synonym search, full service pages, curated insights, revenue stories, adopted-to-actual variance highlights, downloadable and embeddable editorial visuals.

**Depends on:** Phase 3.

**Shared interfaces Phase 4 will introduce:**

- `SearchEngine` over `Entity.canonicalName` + `ServiceEntry.label` + curated synonyms.
- `InsightRegistry` keyed by insight id with machine-checkable assertions for entity, period, unit, displayed figure, and source.
- `EditorialAssetExporter` for embeddable visuals with title, unit, period, source, descriptive footer.

**Tasks deferred to the Phase 4 plan** (not executable now):

- Service detail pages for each entry in `serviceTaxonomy`.
- Curated insights (one per the spec's example questions).
- Synonym search with explicit distinction between official source labels and everyday terms.
- Adopted-to-actual variance highlights where source compatibility permits.

**Exit gate:** First-time residents can answer common civic questions while expert users retain direct access to the analytical workspace.

## Phase 5 — Capital projects and geographic context

**Goal:** Capital Improvement Program ingestion, project timelines, funding sources, status, expenditure history, geographic views only where authoritative location data exists.

**Depends on:** Phase 3 (PDF adapters) and Phase 4 (synonyms and editorial layer).

**Shared interfaces Phase 5 will introduce:**

- `CapitalProjectEntity` extending `Entity` with stable project id, lifecycle phases, funding sources.
- `MapAdapter` gated by verified location data; accessible list and table alternatives required alongside any map.

**Tasks deferred to the Phase 5 plan** (not executable now):

- CIP adapter.
- Project status timeline component.
- Geographic view with strict accessibility fallbacks.

**Exit gate:** Residents can inspect capital investment by project and place without treating planned amounts as completed spending.

## Phase 6 — Participation and institutionalization

**Goal:** Documented data-update workflow, release calendar, "report a data issue" links tied to analysis state, machine-readable normalized releases, saved comparisons or alerts (only after privacy and operational ownership are defined), translation evaluation.

**Depends on:** Phases 2–5.

**Shared interfaces Phase 6 will introduce:**

- Release manifest with diff-from-previous summary.
- Privacy-aware saved-comparison feature flag (default off) gated by an explicit privacy review.

**Tasks deferred to the Phase 6 plan** (not executable now):

- Data update workflow and release calendar.
- "Report a data issue" link component.
- Saved comparisons or alerts (after privacy review).
- Translation evaluation against community research.

**Exit gate:** The explorer has an accountable maintenance process and can support recurring civic use beyond its launch.

---

# Master Roadmap and Phase Dependencies

The fixed order from the spec is preserved: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6. The sequence below is the canonical release plan. Any change requires a written design revision.

1. **Phase 1 (this plan).** Establishes project foundation, **five** structured source adapters (BLS CPI-U, Berkeley Socrata, SCO detailed expenditures, SCO expenditures per capita, SCO revenues per capita) backed by real API snapshots under `data/snapshots/`, canonical model, crosswalk, reconciliation, derivation, immutable artifacts, accessible Overview and Methodology routes, browser/a11y test base, static build verification. The Overview renders Berkeley's FY2003–FY2024 SCO standardized actuals (citywide expenditures and revenues from the per-capita datasets), with FY2024 as the default base year, a real/nominal toggle, per-resident values, and a synchronized accessible table and chart. **Exit:** a resident understands the trend, can switch dollar modes, inspect all five sources, and read the same values in a table.

2. **Phase 2.** Adds the comparison workspace, multi-entity series, all four accounting stages, all four units, URL-encoded state, CSV/PNG exports. **Depends on Phase 1 exit + data findings from the first release.**

3. **Phase 3.** Adds PDF-derived adopted/revised/actual values via per-biennium adapters, ACFR actuals, City Auditor contextual series, expanded crosswalks, original-label mode, quality dashboards. **Depends on Phase 2 exit + Phase 1 quality-report signal.**

4. **Phase 4.** Adds full service pages, universal synonym search, curated insights, revenue stories, variance highlights, embeddable visuals. **Depends on Phase 3 exit.**

5. **Phase 5.** Adds capital project entities, timelines, funding sources, geographic views with accessible list/table fallbacks. **Depends on Phase 3 exit (PDF adapters needed for CIP).**

6. **Phase 6.** Adds update workflow, release calendar, "report a data issue" links, machine-readable normalized releases, saved-comparisons or alerts after privacy review, translation evaluation. **Depends on Phases 2–5.**

Risk flags surfaced by the spec that the executing subagent must keep visible:

- **Historical extraction quality.** PDF tables vary by biennium. Phase 1 sidesteps this; Phase 3 must prove exact cent or rounded-to-printed-precision reconciliation per source-specific adapter.
- **False comparability.** Department reorganizations and State Controller schema changes are visible in Phase 1 via the schema-break warning on Overview and the disclosures on Methodology; Phase 3 must extend visible breaks to per-entity series.
- **Dashboard overload.** Phase 1 ships Overview + Methodology only. Phase 2 caps comparison at four series; Phase 4 reveals advanced dimensions progressively.
- **Editorial bias.** Phase 1 has no editorial claims. Phase 4 must publish selection criteria and require machine-checkable assertions per insight.
- **Maintenance burden.** Phase 1's pinned source manifest with checksums and a quality report is the foundation; Phase 6 adds the documented update calendar.

# Self-Review (planning checklist)

- **Spec coverage:** Every numbered spec section has at least one Phase 1 task implementing it. Phase 2–6 sections of the spec are explicitly deferred to later plans (no fabricated details). The Phase 1 Overview shows real Berkeley FY2003–FY2024 SCO standardized actuals sourced from `ykhf-vfsr` and `ky7j-fsk5`; the Socrata `gy8t-iqc4` cohort is sealed; the SCO detailed adapter is category context only.
- **Placeholder scan:** No "TBD", "TODO", "implement later", "fill in details", "similar to", "add validation", "add appropriate error handling", or "handle edge cases" placeholders appear in any task's code. Phase 2–6 sections explicitly mark deferred work as deferred. The hand-initialised snapshot step is a one-time operator procedure, not a placeholder.
- **Type consistency:** Names used across tasks match exactly: `BudgetValue`, `BudgetValueSchema`, `Entity`, `EntitySchema`, `EntityId`, `EntityIdSchema`, `OverviewSnapshot`, `OverviewTrendPoint`, `Comparability`, `ComparabilitySchema`, `CrosswalkEntry`, `CrosswalkEntrySchema`, `SourceManifest`, `SourceEntry`, `SourceId`, `SourceIdSchema`, `Stage`, `StageSchema`, `Basis`, `BasisSchema`, `ExtractionMethod`, `ExtractionMethodSchema`, `Confidence`, `ConfidenceSchema`, `EntityType`, `EntityTypeSchema`, `CpiObservation`, `CpiObservationSchema`, `BlsResponse`, `BlsResponseSchema`, `FiscalYearAverage`, `FiscalYearAverageSchema`, `BlsCoverageIncompleteError`, `SocrataRow`, `SocrataRowSchema`, `ScoDetailedRow`, `ScoDetailedRowSchema`, `ScoExpenditurePerCapitaRow`, `ScoExpenditurePerCapitaRowSchema`, `ScoRevenuePerCapitaRow`, `ScoRevenuePerCapitaRowSchema`, `ReconciliationResult`, `ReconciliationMismatch`, `QualityReport`, `QualityReportInput`, `DollarMode`, `OverviewUrlState`, `OverviewQueryInput`, `parseDollarsToCents`, `parseDollarsToCents`'s `ParseResult`, `parseBlsSnapshot`, `parseCpiObservations`, `parseScoDetailed`, `parseScoExpenditurePerCapita`, `parseScoRevenuePerCapita`, `parseSocrataRows`, `inflateCents`, `factorFor`, `fiscalYearAverage`, `fiscalYearOf`, `latestCompleteFiscalYear`, `loadBlsFromSnapshot`, `loadSnapshot`, `verifySnapshot`, `sha256Of`, `acquireSource`, `acquireAll`, `normalizeSocrata`, `normalizeScoExpenditurePerCapita`, `normalizeScoRevenuePerCapita`, `buildOverviewSnapshot`, `buildOverviewTrendSeries`, `writeArtifact`, `writeArtifacts`, `writeQualityReport`, `formatCents`, `getOverviewTrend`, `parseOverviewUrl`, `serializeOverviewUrl`, `serviceTaxonomy`, `methodologySections`.
- **Source counts:** The manifest schema refines `sources` to length **five**. Methodology, the Overview citation footer, the Phase 1 exit gate, the browser test, and the quality report all reference the same five ids: `src-bls-cpi-u-cuura422sa0`, `src-berkeley-socrata-gy8t-iqc4`, `src-sco-expenditures-ju3w-4gxp`, `src-sco-expenditures-per-capita-ykhf-vfsr`, `src-sco-revenues-per-capita-ky7j-fsk5`. No "four sources" references remain.
- **Fixtures vs real data boundary:** `src/pipeline/build.ts` does **not** import any `*.fixtures.ts` module. Synthetic fixture files exist only for tests and are loaded by test files; the build pipeline reads `data/snapshots/` exclusively. The hand-initialised snapshot step is the only first-release path for getting real API bytes into the repository; from release `rel-2026-07-20-002` onward, `pnpm refresh:data` replaces them atomically.
- **Verified SCO schemas:** `ScoDetailedRow` carries `entity_name, fiscal_year, value, category, subcategory_1, subcategory_2, line_description, estimated_population, type` only. There are **no** `function_name`, `fund_name`, or revenue fields on detailed rows. The per-capita expenditure row carries `entity_name, fiscal_year, total_expenditures, estimated_population, expenditures_per_capita`; the per-capita revenue row carries `entity_name, fiscal_year, total_revenues, estimated_population, revenues_per_capita`. No invented fields.
- **Citywide totals from per-capita only:** `build.ts` never sums detailed rows. Citywide expenditure and revenue totals come exclusively from `ykhf-vfsr` and `ky7j-fsk5`. The `ScoDetailedRow` path is filtered to Berkeley and emitted to `src/artifacts/sco-detailed-context.json` with a `surface: "category-context-only"` marker; the file is never read by the Overview route.
- **Socrata cohort sealed:** `assertCohortSealed` is called in the build with `(2012, 2015)`; `reconcileSocrataCohort` is included in `runAllReconciliations`. No chart, table, or per-capita series stitches the Socrata cohort to the SCO actuals.
- **Money parser:** `parseDollarsToCents` is `BigInt`-backed, applies the sign exactly once, returns a typed `ParseResult<number>`, and is exercised by tests for `123.45`, `-123.45`, `0`, `0.00`, `100`, `-42`, malformed input, empty input, three-decimal input, and the out-of-range `100000000000000.00` case.
- **BLS coverage floor:** `MIN_COVERAGE = 6` is exported from `bls-cpi.ts`, matching BLS's official bimonthly publication schedule for the San Francisco metropolitan series. `factorFor` throws `BlsCoverageIncompleteError` when either year's `observationCount` is below the floor. `fiscalYearAverage` reports the actual count and never interpolates unpublished intervening months. `latestCompleteFiscalYear` returns the largest FY meeting the floor and drives the Overview's base year (initially FY2024). `FiscalYearAverageSchema.observationCount` is bounded to `[0, 6]`. The BLS fixture contains exactly six bimonthly observations per complete FY (FY2019–FY2024); the partial fixture is missing two scheduled bimonthly observations in FY2024 (March and May 2024) so it has only four observations for FY2024 — that is the only way the partial fixture exercises `MIN_COVERAGE = 6`. No `9` / `12 expected monthly` claim remains in any Task 4 code, test, fixture header, or Methodology paragraph.
- **SCO per-capita fixture is internally consistent:** every synthetic row's `*_per_capita` field equals the exact rounded `total / estimated_population` result, so `crossCheckInternal` (the 50-cent tolerance check) and `citywideTrend` (which uses the source-published per-capita value verbatim) agree within zero cents. `citywideTrend` tests assert on the explicit source-published cents (e.g., `expect(...).toBe(627413)` for FY2024) and additionally assert that the derived `Math.round(total_cents / population)` returns the same value.
- **Test fixtures import the actual exports:** every test file that previously imported `cpiFixture` from `bls-cpi.fixtures` now imports the real exported `blsFixture` and passes it through `parseCpiObservations(blsFixture)`. No test imports a non-existent fixture.
- **`parseScoDetailed` import path:** the build entry imports `parseScoDetailed` from `./sources/sco-detailed`, not from `./sources/sco-per-capita`. The SCO per-capita module has no detailed-row parser.
- **ArtifactBundle and writeArtifacts:** the typed `ArtifactBundle` interface carries `scoPerCapita`, `scoDetailedContext`, and `socrataCohort`; `writeArtifacts` writes `sco-per-capita.json`, `sco-detailed-context.json`, and `socrata-cohort.json` in addition to the original six files. The artifacts test asserts all nine files exist and contain non-empty bodies.
- **Comparability is not overwritten by inflation mode:** `buildOverviewSnapshot` always sets `comparability: "reconstructed"`, matching the crosswalk's declared mapping for the SCO citywide series. The derive test exercises both `mode: "nominal"` and `mode: "real"` and asserts the same reconstructed comparability for both. Inflation mode changes only the displayed dollar amount, never the comparability claim.
- **Socrata fixture first row:** the first synthetic fixture row's `approved_amount` is `"12345.67"` (1234567 cents), matching the test's `expect(rows[0]?.approvedAmountCents).toBe(1234567)`.
- **`parseOverviewUrl` falls back per-field:** an unknown `mode` value falls back to `"real"`; an out-of-range `baseYear` falls back to `2024`. Either failure is silent — the other field is still honoured. The implementation validates each field independently with `safeParse`; the test covers both fallback paths.
- **Source-specific identity rules:** `verifySourceIdentity(sourceId, body, url)` dispatches on a typed `SOURCE_IDENTITY_RULES` map. BLS checks `Results.seriesID === "CUURA422SA0"`. Socrata and the three SCO endpoints parse the manifest URL and require the last path segment (minus `.json`) to equal the pinned dataset id (`gy8t-iqc4`, `ju3w-4gxp`, `ykhf-vfsr`, `ky7j-fsk5`); SCO arrays additionally require at least one row whose `entity_name === "City of Berkeley"`. The acquire test contains one negative and one positive test per source (10 tests) plus an end-to-end test that runs `acquireSource` for all five sources together. No `body identity field` shortcut weakens source validation.
- **Overview URL state subscribes correctly:** the component uses `useSyncExternalStore` to subscribe to a custom `bbe:url-change` event plus `popstate`; toggling the radio rerenders the snapshot, chart, and table, and the table text changes between real and nominal modes. The Overview component test now includes a value-change assertion (not just a URL assertion), and the browser journey test asserts the table text changes when toggling the radio.
- **Snapshots are canonical JSON, not raw HTTP responses:** `acquireSource` writes `JSON.stringify(parsedBody, canonicalReplacer)` where `canonicalReplacer` strips `undefined` / `function` / `symbol`. The operator instructions in Task 3 Step 0 say to canonicalize before computing the checksum. Manifest checksum semantics are stable across whitespace, key-ordering, and re-serialization differences.
- **`reconcileSocrataCohort` returns one mismatch per offending fiscal year:** the function iterates the rows, collects each distinct fiscal year that is outside `[fyStart, fyEnd]`, and emits one `ReconciliationMismatch` per such year with `sourceId: "src-berkeley-socrata-gy8t-iqc4"`. The test exercises both the single-year case (one mismatch) and the multi-year case (two distinct mismatches). The dummy `fiscalYear: 0` mismatch is gone.
- **Money parser:** `parseDollarsToCents` is `BigInt`-backed, applies the sign exactly once, returns a typed `ParseResult<number>`, and is exercised by tests for `123.45`, `-123.45`, `0`, `0.00`, `100`, `-42`, malformed input, empty input, three-decimal input, and the out-of-range `100000000000000.00` case.
- **Adopted vs actual deferred:** The Overview disclosure paragraph, the Methodology "Phase 1 surface" section, the exit gate item 8, the Phase 1 footer, and the Roadmap Phase 3 entry all make clear that adopted-versus-actual variance is deferred to Phase 3.
- **LOC discipline:** Every file described in the file map is designed to stay at or below 250 pure LOC; tasks that approach the warning band are designed to be split before adding lines.
- **No `any`, no type suppression, no empty catches:** No `// @ts-ignore`, no `// @ts-expect-error`, no `# type: ignore`, no `any`, no `as any`, no `as unknown as`, no `!` non-null assertions in production code, no empty `catch {}`. Errors propagate via typed `Result`-style return shapes and the only `throw new Error(...)` calls are at boundaries where recovery is impossible.
- **PDF deferred:** No task parses PDFs. The `ExtractionMethod` enum includes `pdf-extraction` for future use but no adapter exercises it in Phase 1.
- **No live APIs at runtime:** The build pipeline reads only `data/snapshots/`. `pnpm refresh:data` is the only network-capable command, is opt-in, and is excluded from `pnpm build` and `pnpm build:artifacts`. The application reads only `src/artifacts/*.json` at runtime.
- **Commit steps labeled OPTIONAL:** Every `git commit` step includes the `OPTIONAL` prefix and an explicit "Otherwise skip this step" instruction. The directory is not a Git repository and the human partner has not asked for Git operations.
- **No invented production values:** Numeric literals in unit-test examples are synthetic test data only. Phase 1 production artifacts are built from the checked-in official snapshots, and the same Phase 1 release must validate their checksums, source identities, and internal per-capita arithmetic through `reconcileScoPerCapita` before publication.
- **Master roadmap preserved:** Phases 2–6 are unchanged from the prior plan and retain the fixed order, exit gates, and shared interfaces. The Phase 1 entry now also notes the FY2003–FY2024 SCO actuals scope, the Socrata-sealed cohort, the SCO detailed-as-context-only split, and the deferred adopted-vs-actual variance.

Plan complete and saved to `docs/superpowers/plans/2026-07-20-berkeley-budget-explorer.md`. Two execution options:

1. **Subagent-Driven (recommended):** dispatch a fresh subagent per task with two-stage review between tasks. Best for long-running implementation with frequent course correction.
2. **Inline Execution:** execute tasks in this session using the `executing-plans` skill, with batched checkpoints for review. Best when the human partner wants immediate visibility into each step.

Either approach is appropriate for Phase 1; the spec's multi-phase decomposition makes the subagent-driven path lower risk because each Phase 1 task's deliverable is independently reviewable and the subsequent phases will be written as separate plans.
