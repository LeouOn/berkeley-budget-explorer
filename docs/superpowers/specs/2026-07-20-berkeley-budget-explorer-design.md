# Berkeley Budget Explorer Design

**Date:** July 20, 2026  
**Status:** Approved design awaiting written-spec review  
**Product direction:** Layered civic atlas

## 1. Purpose

Build an elegant, trustworthy website that lets anyone understand and analyze the City of Berkeley's budget over time. The product must welcome residents who do not know municipal accounting while also supporting journalists, researchers, advocates, and city staff who need precise comparisons, source records, and exports.

The primary organizing outcome is open-ended comparison. Guided explanations and editorial highlights help visitors discover useful questions, but they must link into the same reproducible comparison system available to expert users.

## 2. Product Principles

1. **Progressive disclosure:** Start with recognizable services and plain-language findings, then expose funds, departments, programs, and account categories as users go deeper.
2. **Comparison is the core interaction:** Any supported budget entity should be comparable across years and accounting stages.
3. **Real dollars by default:** Historical views default to inflation-adjusted dollars, with nominal reported amounts always one explicit toggle away.
4. **Plans and outcomes remain distinct:** Adopted, revised, projected, and actual values must never be blended into a single unlabeled series.
5. **Source fidelity is visible:** Every value retains its source, extraction method, freshness, and comparability status.
6. **No false continuity:** Renames, reorganizations, missing detail, and schema breaks must appear in the interface instead of being silently normalized.
7. **One analysis, many representations:** Charts, tables, summaries, downloads, and shareable URLs must derive from the same query result.
8. **Accessible by default:** Tables and textual summaries are first-class outputs, not fallback attachments.
9. **Elegant rather than ornamental:** Visual design should emphasize hierarchy, typography, direct labeling, and restrained motion rather than dashboard chrome.
10. **Fast without live dependencies:** Published pages must remain useful if Berkeley or state data portals are unavailable.

## 3. Audiences

### 3.1 Residents

Residents need plain-language explanations, recognizable services, a quick account of what changed, per-resident context, and confidence that the figures are authoritative. The default experience should avoid requiring knowledge of fund accounting.

### 3.2 Journalists and researchers

These users need multi-series comparisons, exact figures, permanent URLs, CSV exports, methodological notes, source documents, and warnings about incompatible periods.

### 3.3 Advocates and community organizations

These users need comparisons among policy priorities, embeddable or downloadable visuals, accessible summaries, and enough sourcing to support public testimony or reports.

### 3.4 City staff and budget experts

These users need fund, department, service, program, revenue, and expense-category views; distinctions among adopted, revised, projected, and actual values; and mappings back to official terminology.

The product does not create separate applications for these groups. A single information architecture reveals more detail as users move from discovery to comparison to investigation.

## 4. Experience Model

### 4.1 Discover

The home page opens with a concise fiscal snapshot:

- Total adopted budget for the selected fiscal year.
- Latest audited actual expenditures.
- Total revenue and operating balance where comparable.
- Inflation-adjusted change over one, five, and ten years.
- Per-resident amount using the population series named in methodology.
- Largest increases and decreases by stable service category.
- Largest adopted-to-actual variances for years with compatible data.
- A visible caveat when the newest adopted year does not yet have actuals.

Below the snapshot, service cards represent resident-recognizable topics such as housing, public safety, streets, libraries, parks and recreation, health, climate and environment, economic development, and general government. Each card includes the selected-year amount, share of total, change from the comparison year, and a small directly labeled trend.

Curated insight cards answer concrete questions, such as:

- Which services grew most after inflation?
- Where did actual spending differ most from the adopted budget?
- How has the General Fund changed relative to enterprise and special funds?
- What portion of the budget is capital investment?
- Which apparent changes are caused by reorganizations rather than spending decisions?

Every insight links to a fully configured comparison instead of presenting an untraceable editorial statistic.

### 4.2 Compare

The comparison workspace is a persistent, first-class destination. Users can search for and select up to four entities drawn from:

- Services.
- Departments.
- Funds and fund groups.
- Programs where source detail permits.
- Revenue categories.
- Expense categories.
- Capital projects where source detail permits.

Comparison controls support:

- Fiscal-year range.
- Adopted, revised, projected, and actual accounting stages.
- Inflation-adjusted or nominal dollars.
- Absolute dollars, per-resident dollars, percentage change, or share of total.
- Expenditures, revenues, or budget-to-actual variance.
- Stable analytical categories or original source labels.

The default comparison uses a line chart for trends. A grouped bar view supports discrete year and adopted-versus-actual comparisons. A composition view supports shares of a whole, but no Sankey or treemap may be the only way to inspect values. Each visualization has direct labels, a concise textual finding, a synchronized semantic table, and CSV and image export.

The URL encodes all comparison state. Copying the URL must reproduce selected entities, date range, accounting stage, unit, inflation mode, and chart view.

### 4.3 Investigate

Every selectable entity has a detail page containing:

- Official name and plain-language description.
- Parent and child hierarchy.
- Current amount, share, and historical trend.
- Adopted, revised, projected, and actual values where available.
- Revenue sources or expense composition where applicable.
- Related departments, funds, programs, and services.
- Known renames, reorganizations, and comparability breaks.
- Source documents and machine-readable records.
- Extraction confidence and review status for PDF-derived values.
- Download and share actions.

The detail page preserves original source labels even when the selected entity belongs to a stable analytical series.

## 5. Information Architecture

The primary navigation is:

1. **Overview** — fiscal snapshot, service cards, and curated changes.
2. **Compare** — open analytical workspace.
3. **Services** — resident-recognizable spending and revenue themes.
4. **Revenue** — taxes, fees, transfers, grants, and other sources.
5. **Capital Projects** — the Capital Improvement Program and project history.
6. **Insights** — dated, sourced analyses that deep-link into comparisons.
7. **Methodology** — sources, definitions, mappings, limitations, and releases.

A universal search maps official names and curated everyday-language synonyms. Searching for “potholes,” for example, may return streets, paving programs, and relevant capital projects, while clearly distinguishing the synonym from official source terminology.

## 6. Visual Direction

The visual identity should feel civic, editorial, and distinctly Berkeley without imitating the city's existing website or relying on generic government-dashboard styling.

- Use a warm neutral canvas, deep ink text, and a restrained palette inspired by Bay Area landscape and Berkeley civic materials.
- Use typography and spacing to establish hierarchy before containers or borders.
- Reserve saturated color for selected comparisons, material changes, and warnings.
- Use patterns, line styles, labels, and icons in addition to color.
- Prefer direct annotations to legends where space permits.
- Use motion only to explain changes in state; respect reduced-motion preferences.
- Keep charts visually quiet enough to support four simultaneous series.
- Avoid decorative three-dimensional charts, unlabeled area charts, and hover-only disclosure.

Desktop layouts may place controls beside results. Mobile layouts use a single-column flow, a compact comparison summary, and an explicit control drawer. All values available on hover must also be available through focus, labels, or the table.

## 7. Authoritative Data Sources

### 7.1 City budget publications

Use the City of Berkeley budget archive as the authoritative source for adopted and proposed budgets. The verified archive provides operating budget books from FY2010 through the FY2027–FY2028 adoption period, plus mid-biennial updates and Capital Improvement Programs.

Canonical index:

- https://berkeleyca.gov/your-government/financial-information/city-budget

The ingestion manifest must pin each source URL, fiscal period, publication type, checksum, retrieval date, and parser version.

### 7.2 City actuals and financial reports

Use Annual Comprehensive Financial Reports as the preferred source for year-end actuals and audited fund statements. The verified city archive contains ACFRs for FY2023, FY2024, and FY2025. Use Budget and Finance Committee reports for in-year projections and explicitly label them as unaudited projections rather than actuals.

Canonical index:

- https://berkeleyca.gov/your-government/financial-information/financial-reports-and-policies

The City Auditor's 2026 financial-condition report may support contextual ten-year series when its definitions can be reproduced and cited. It must not be treated as line-item data.

### 7.3 Berkeley Open Data Portal

Use Socrata dataset `gy8t-iqc4` for the sealed FY2012–FY2015 operating-budget line-item cohort. Its known fields include fiscal year, department, program, service, expense category, approved amount, fund, description, and expense type.

- Catalog: https://data.cityofberkeley.info/Budget/City-of-Berkeley-Operating-Budget/gy8t-iqc4
- API: https://data.cityofberkeley.info/resource/gy8t-iqc4.json

The dataset stops at FY2015 and must not imply continuity into later years.

### 7.4 California State Controller

Use the State Controller's standardized city datasets for longer total and per-capita actual-expenditure and revenue history:

- City Expenditures: https://bythenumbers.sco.ca.gov/Finance-Application/City-Expenditures/ju3w-4gxp
- City Expenditures Per Capita: https://bythenumbers.sco.ca.gov/Cities/City-Expenditures-Per-Capita/ykhf-vfsr
- City Revenues Per Capita: https://bythenumbers.sco.ca.gov/Cities/City-Revenues-Per-Capita/ky7j-fsk5

Berkeley records span FY2003–FY2024 in the verified datasets. The detailed expenditure schema changes materially in FY2017, so cross-boundary category trends require an explicit mapping and visible warning.

### 7.5 Inflation and population

Use BLS CPI-U series `CUURA422SA0`, All Items in San Francisco-Oakland-Hayward, for the default regional inflation adjustment. Convert fiscal-year values with a documented annual-average method and name the displayed base year.

Use the State Controller datasets' `estimated_population` values for initial per-resident series because they are published with the verified Berkeley revenue and expenditure totals. Initial per-resident views therefore end at FY2024. A later migration to California Department of Finance estimates must recompute the complete historical series in one versioned release; it may not splice a second population source onto the State Controller series.

## 8. Canonical Analytical Model

### 8.1 Budget value

Each normalized value contains:

- `fiscalYear`: four-digit ending year.
- `amountNominal`: source-reported dollars.
- `stage`: `proposed`, `adopted`, `revised`, `projected`, or `actual`.
- `basis`: source accounting basis, such as budgetary or GAAP.
- `entityId`: stable entity identifier.
- `entityType`: service, department, fund, program, revenue category, expense category, or capital project.
- `sourceId`: immutable source-manifest identifier.
- `sourceLabel`: verbatim source label.
- `extractionMethod`: API, structured table, manual transcription, or PDF extraction.
- `confidence`: verified, review-required, or excluded.
- `schemaVersion`: canonical schema version.

Inflation-adjusted amounts are derived at query or artifact-build time from `amountNominal`, the selected base year, and the pinned CPI series. They are not stored as independent source facts.

### 8.2 Entities and mappings

Original source entities remain immutable. A versioned crosswalk maps them to stable analytical entities with:

- Effective fiscal-year range.
- Mapping rationale.
- One-to-one, many-to-one, or partial status.
- Reviewer and review date.
- Comparability level: exact, reconstructed, approximate, or incompatible.

Approximate mappings may appear in exploratory views only when visibly labeled. They may not power a precise adopted-to-actual variance claim.

### 8.3 Accounting stages

- **Proposed:** Executive or staff recommendation before adoption.
- **Adopted:** Budget approved for the fiscal year or biennium.
- **Revised:** Legally or administratively amended budget.
- **Projected:** In-year estimate that is not a completed actual.
- **Actual:** Completed expenditure or revenue reported by an authoritative year-end source.

The interface must not call projected values actuals. When comparing adopted and actual values, it must state whether the two share the same accounting basis and organizational scope.

## 9. Data Pipeline

The application uses a versioned build-time pipeline with no runtime dependency on source APIs.

1. **Acquire:** Download pinned documents and API extracts into a source cache while recording checksums and retrieval metadata.
2. **Extract:** Parse structured APIs directly; extract PDF tables through source-specific adapters; preserve raw extracted rows.
3. **Validate:** Check schemas, types, fiscal periods, duplicate keys, required labels, and source totals.
4. **Normalize:** Convert records to the canonical model without discarding original labels.
5. **Map:** Apply versioned entity crosswalks and comparability levels.
6. **Reconcile:** Compare aggregates with published control totals and reject releases outside the exact policies below.
7. **Derive:** Build CPI factors, per-resident measures, shares, changes, and safe precomputed aggregates.
8. **Publish:** Emit compact immutable data artifacts, a release manifest, and a human-readable quality report.

A pipeline release fails when:

- A required source checksum changes without review.
- Required columns disappear or change type.
- Canonical keys are duplicated.
- Structured source records fail to equal their published machine-readable control total to the cent.
- PDF-derived records fail to equal a displayed control total after both are rounded to the precision printed in that document. For example, a table printed in thousands must match after rounding both totals to the nearest thousand dollars.
- A mapping targets an unknown entity or overlaps an incompatible effective period.
- An editorial insight references unavailable or non-verified records.

PDF-derived rows marked review-required are not included in public normalized comparisons until reviewed. Excluded rows remain documented in the quality report.

## 10. Application Architecture

The public application is statically deployable. It reads only validated, versioned artifacts and uses typed domain queries for every view.

Major units are:

- **Data artifact client:** Loads release metadata, dimensions, and requested series.
- **Query engine:** Filters, groups, compares, adjusts for inflation, and reports comparability.
- **Presentation adapters:** Convert one query result into chart, table, summary, citation, and export models.
- **Explorer state:** Parses and serializes URL state with schema validation and safe defaults.
- **Content layer:** Stores curated service descriptions, synonyms, insight narratives, and methodology copy.
- **Design system:** Supplies accessible controls, cards, annotations, tables, dialogs, and chart framing.

No chart component may fetch or aggregate source data independently. No editorial claim may hard-code a value that the query engine can calculate.

## 11. Error and Uncertainty Handling

The product distinguishes four conditions:

1. **No data:** The authoritative source does not publish the requested combination.
2. **Not yet available:** The stage is expected later, such as actuals for a current adopted budget.
3. **Not comparable:** Values exist but definitions, scope, or accounting basis prevent a defensible comparison.
4. **Processing failure:** A valid published artifact could not be loaded or interpreted.

Each condition receives specific copy and a useful next action. The application must not display zero for missing values, silently drop incompatible years, or substitute statewide totals for unavailable Berkeley detail.

Every result displays:

- Data release date.
- Source or source set.
- Dollar mode and base year.
- Accounting stages.
- Comparability status.
- Link to methodology and source documents.

## 12. Accessibility Requirements

Target WCAG 2.2 AA and test the following as release criteria:

- All functionality is operable by keyboard.
- Focus order and focus visibility remain correct in comparison controls and chart detail interactions.
- Charts use direct labels and redundant non-color encodings.
- Every chart has a concise text summary and a synchronized semantic table.
- Tables identify headers and provide meaningful captions.
- Hover information is available on focus and in the table.
- Screen readers receive the data and summary without redundant narration of decorative chart marks.
- Controls expose names, states, errors, and help text programmatically.
- Touch targets and mobile layouts remain usable at 320 CSS pixels wide.
- Text supports 200 percent zoom without loss of functionality.
- Motion honors `prefers-reduced-motion`.
- Exported images include a title, unit, period, source, and descriptive footer.

## 13. Performance and Resilience

- The initial route must not load the complete line-item corpus.
- Overview aggregates and common dimensions are precomputed.
- Detail series load on demand from cacheable immutable artifacts.
- Source APIs and city websites are never required during a user session.
- The application provides an actionable offline/error state when an artifact is unavailable.
- Performance budgets will be defined in the implementation plan and verified on a representative mid-range mobile profile.

## 14. Testing Strategy

### 14.1 Pipeline tests

- Source-adapter fixtures for each API and PDF table format.
- Schema and type validation tests.
- Duplicate and missing-key tests.
- Reconciliation tests against source control totals.
- Crosswalk effective-date and overlap tests.
- Inflation-factor tests using known CPI examples.
- Per-resident calculation tests using a pinned population series.
- Golden release tests that detect historical-data drift.

### 14.2 Domain-query tests

- Filtering and grouping by every supported entity type.
- Adopted-versus-actual variance calculations.
- Nominal and inflation-adjusted results.
- Share, per-resident, and percentage-change units.
- Comparability propagation when a selected series crosses a schema break.
- URL parse/serialize round trips.
- Export values matching displayed table values.

### 14.3 Component and accessibility tests

- Keyboard operation and focus management.
- Accessible names, descriptions, and error relationships.
- Chart/table synchronization.
- Non-color series differentiation.
- Responsive control behavior.
- Empty, unavailable, incompatible, and failure states.

### 14.4 Browser journeys

- Read the overview and open a service detail.
- Search for an everyday term and inspect official matches.
- Compare four entities across a historical range.
- Toggle real and nominal dollars without losing selection.
- Compare adopted and actual values and read the comparability note.
- Copy a URL and restore the exact analysis in a fresh session.
- Download CSV and verify it matches the visible table.
- Complete the same core journeys at mobile width and with keyboard only.

### 14.5 Editorial verification

Each published insight includes machine-checkable assertions for its selected entities, period, unit, and displayed figures. A data release cannot publish an insight whose assertions no longer match the query engine.

## 15. Delivery Roadmap

The roadmap must preserve the broad audience vision while keeping each release coherent and independently useful.

### Phase 1 — Trustworthy historical foundation

- Establish the project, design system foundation, and static deployment.
- Build the source manifest and adapters for Berkeley's FY2012–FY2015 Socrata data, State Controller totals, BLS CPI, and one recent adopted budget and ACFR.
- Implement the canonical model, crosswalk format, validation, reconciliation, and release report.
- Ship an accessible overview, core service taxonomy, nominal/real toggle, historical total trend, source citations, and tables.
- Publish methodology and known limitations before adding broad comparisons.

**Exit condition:** A resident can understand Berkeley's overall budget trend, switch dollar modes, inspect sources, and read the same values without a chart.

### Phase 2 — Comparison workspace

- Add multi-entity comparison for services, departments, funds, revenues, and expense categories where source compatibility permits.
- Add adopted, revised, projected, and actual stages.
- Add absolute, per-resident, percentage-change, and share-of-total units.
- Add shareable URL state, CSV exports, image exports, and comparison annotations.
- Surface FY2015/2016 and FY2017 schema breaks visibly.

**Exit condition:** A journalist can reproduce and share a defensible four-series comparison and download its underlying records.

### Phase 3 — Comprehensive Berkeley history

- Extract and review adopted budget books from FY2010 onward.
- Add ACFR actuals and City Auditor contextual series for all defensible years.
- Expand and review stable category crosswalks.
- Add original-label and stable-series modes.
- Add quality dashboards for source coverage, confidence, and reconciliation.

**Exit condition:** Users can traverse the longest defensible Berkeley history without the interface implying false line-item continuity.

### Phase 4 — Guided civic atlas

- Add full service pages, universal synonym search, curated insights, and plain-language budget education.
- Add revenue stories, adopted-to-actual variance highlights, and organization-change annotations.
- Add downloadable and embeddable editorial visuals.
- Conduct resident, journalist, advocate, and city-staff usability sessions.

**Exit condition:** First-time residents can answer common civic questions while expert users retain direct access to the analytical workspace.

### Phase 5 — Capital projects and geographic context

- Ingest the Capital Improvement Program and stable project identifiers.
- Add project timelines, funding sources, status, and expenditure history where authoritative data permits.
- Add geographic views only for projects with verified locations.
- Provide accessible list and table alternatives to maps.

**Exit condition:** Residents can inspect capital investment by project and place without treating planned amounts as completed spending.

### Phase 6 — Participation and institutionalization

- Add a documented data-update workflow and release calendar.
- Add “report a data issue” links tied to analysis state.
- Publish machine-readable normalized releases and methodology changes.
- Add saved comparisons or alerts only after privacy and operational ownership are defined.
- Evaluate translations based on community research rather than automatic machine translation alone.

**Exit condition:** The explorer has an accountable maintenance process and can support recurring civic use beyond its launch.

## 16. Out of Scope for the Initial Release

- Real-time transaction monitoring.
- Forecasting or policy recommendations presented as facts.
- User accounts, private saved workspaces, or notifications.
- Participatory budgeting simulations.
- Automated claims about waste, fraud, or program effectiveness.
- Combining City of Berkeley finances with Berkeley Unified School District, Alameda County, UC Berkeley, or special districts without explicit jurisdiction labels.
- Geographic maps for operating expenditures without authoritative location data.

These capabilities may be evaluated after the historical foundation and comparison model are trusted.

## 17. Planning Decomposition

The six roadmap phases are related releases, not one implementation batch. After this specification is approved, planning will produce:

1. A master roadmap that records phase dependencies, shared interfaces, release gates, and the sequence below.
2. A decision-complete implementation plan for Phase 1, which establishes the data contracts and application foundation required by later work.
3. A separate implementation plan for each later phase only after the preceding phase passes its exit condition and its data findings are incorporated.

This decomposition keeps the broad multi-audience destination explicit while ensuring each plan produces working, testable software on its own. The roadmap order is fixed unless a written design revision changes it; later-phase implementation details are not guessed before Phase 1 validates the source data.

## 18. Success Measures

### Comprehension

- In usability testing, residents can identify the selected year, dollar mode, and accounting stage without assistance.
- Residents can explain the difference between adopted and actual values after completing one guided comparison.

### Analytical capability

- Expert users can create, share, restore, and export a four-entity historical comparison.
- Every exported value can be traced to a source manifest entry.

### Trust

- No published release contains unresolved reconciliation failures.
- Every normalized value has a source, stage, fiscal year, and confidence status.
- Comparability warnings appear before users interpret incompatible series.

### Accessibility and performance

- Core journeys pass automated and manual WCAG 2.2 AA checks.
- Core journeys work with keyboard only and at 320 CSS pixels.
- Performance stays within the budgets defined in the implementation plan.

## 19. Key Risks and Mitigations

### Historical extraction quality

**Risk:** PDF tables vary by biennium and may produce plausible but incorrect rows.  
**Mitigation:** Source-specific adapters, raw-row preservation, confidence states, control-total reconciliation, and human review before publication.

### False comparability

**Risk:** Department reorganizations and State Controller schema changes create misleading trends.  
**Mitigation:** Effective-dated crosswalks, comparability levels, visible breaks, original-label mode, and exclusion of incompatible variance calculations.

### Dashboard overload

**Risk:** Serving every audience produces a dense interface.  
**Mitigation:** Three-depth experience, resident-recognizable defaults, no more than four compared entities, and advanced dimensions revealed progressively.

### Editorial bias

**Risk:** Highlight selection may imply unsupported judgments.  
**Mitigation:** Publish selection criteria, use descriptive rather than evaluative language, link every claim to a reproducible comparison, and date all insights.

### Maintenance burden

**Risk:** Source formats and links change after launch.  
**Mitigation:** Pinned source manifests, checksum detection, adapter fixtures, failed-release reports, and a documented update calendar.

## 20. Design Acceptance Criteria

The design is ready for implementation planning when:

- The layered civic atlas and three-depth experience are retained.
- Comparison remains a primary destination rather than a secondary report feature.
- Inflation-adjusted dollars are the default with a nominal toggle.
- Adopted, revised, projected, and actual values remain distinct.
- Historical mappings and schema breaks are visible and versioned.
- Charts, tables, summaries, exports, and URLs share one query model.
- WCAG 2.2 AA requirements and mobile behavior are release criteria.
- The roadmap stages broad multi-audience capability without requiring all sources or features in the first release.
