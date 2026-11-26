# Decisions

## FIN-D-043 — Port the v1 Finance foundation, then build Stream B on it
- **Date:** 2026-11-23
- **Status:** confirmed (user).
- **Context:** `Ziki Finance Updated` had no Finance code at all, while PRD v3
  says it builds on the v1 release steps. Stream B needs `FinanceTicker`,
  `FinanceSettings`, the finance agent feed and the Finnhub client.
- **Options:** (a) port the v1 foundation then build Stream B; (b) build a
  self-contained Stream B schema; (c) move the work to the older checkout.
- **Decision:** (a). User: "Port foundations, then build B."
- **Consequences:** the v1 schema, five migrations, spine libs, agent routes and
  staff page are copied in; Stream B adds `FinanceRun`, `FinanceCandidate`,
  `FinanceEvidence`, `FinanceEvaluation` and `FinancePipelineJob`.
- **Related:** FIN-CR-014, FIN-D-044.

## FIN-D-044 — Don't copy the v1 Finance pages or the v2 demo
- **Date:** 2026-11-23
- **Status:** confirmed (implied by PRD v3 and the port scope).
- **Context:** The v1 `/finance` page is the portfolio/briefing UI; PRD v3 makes
  Finance one page plus a stock detail view. The old checkout also carries a v2
  demo (`components/finance/demo-v2`, `lib/finance/demo-v2.ts`).
- **Decision:** skip the v1 pages, briefing/holdings libs and the v2 demo. Build
  the v3 `/finance` and `/finance/<ticker>` pages for Stream B instead.
- **Consequences:** the ported lib is the spine only; Streams A and C add their
  own models and UI.
- **Related:** FIN-CR-014.

## FIN-D-045 — Skip local verification for this pass
- **Date:** 2026-11-23
- **Status:** confirmed (user: "No, code only for now").
- **Consequence:** the first real verification is `pnpm verify:ready` in CI or on
  a machine with `node_modules`. See FIN-I-001.

## FNC-D-001 — Stream B is the foundation
Date: 2026-11-23. CONFIRMED. User: 'Use PR #1 (Stream B) as the foundation'. Build on d63bbaa, reuse FinanceCandidate, FinanceEvaluation, FinanceTicker, FinanceHolding and FinanceSettings. PR #2 has incompatible overlapping models and is not merged here. Target repository is Ziki-Finance/ziki-finance-ziki, never a new fork. Final main-target review must identify the dependency.


## FIN-D-046 — Redesign `/finance` as a research-first command center and `/finance/[ticker]` with position-first & clickable pipeline
- **Date:** 2026-11-25
- **Status:** confirmed (user approved high-fidelity wireframe and requested implementation: "yh dgo ahead").
- **Context:** The original `/finance` page led with a full-width criteria form, exposed raw `GET`/`POST` API paths inline, used conflicting status badge colors (`Not checked yet` in green, `Pending` in solid CTA blue), and hid research/portfolio context on narrow containers.
- **Options considered:** (A) Incremental CSS tweaks to the existing form-first layout; (B) Research-first command center on `/finance` (KPI strip, Stock Research & Analysis at top, Criteria in a side rail + text-first modal with prefilled chips, Portfolio below) and position/recommendation-first `/finance/[ticker]` with clickable 4-stage pipeline (`Screen → Enrich → Evaluate → Decide`) and inline `+ Log a trade`.
- **Decision:** Adopt Option B. Hide raw Agent API endpoints from the investor UI; keep `Log a trade` primarily on the stock detail view (with a subtle fallback in Portfolio for unresearched tickers); use neutral slate for `Not checked yet` and soft/outlined pills for `Next check`.
- **Reason:** Surfaces the highest-value investor output (researched stocks and portfolio thesis health) immediately while keeping criteria authoring lightweight and non-intrusive.
- **Consequences:** Portfolio rows link directly to `/finance/[ticker]`; `/finance/[ticker]` queries the owner's holding so it can display `Your Position` (or `Recommendation` if not held) above the clickable research pipeline.
- **Related:** FIN-CR-015, FIN-CR-014, FIN-D-011.


## FIN-UI-D-001 — Linear/spreadsheet company list + split-screen side panel on `/finance` (supersedes `FIN-D-046` layout)
- **Date:** 2026-11-26
- **Status:** confirmed (user approved interactive wireframe `design-handoff/finance-split-panel-wireframe.html`: "I approved the proposed it's good to go").
- **Context:** Product owner feedback on `FIN-CR-015` asked to remove all top KPI/summary boxes and the separate bottom `PortfolioCard`, focus `/finance` solely on the company list and criteria, group bought companies at the top with recommendations below, display key metrics in compact bordered boxes per row, and open company details in a side panel instead of navigating to `/finance/[ticker]`.
- **Decision:** Replace the 4-card KPI strip and bottom `PortfolioCard` with a single Linear/spreadsheet-style list (`Owned` group at top, `Recommendations` group below) with bordered metric boxes (`Price`, `Status/Thesis Health`, `Value / Buy Range`, `Return / Score`, `Action`) and a unified right split-screen panel that toggles between **Company Detail** (on row click) and **Criteria** (on `Criteria` button click). Keep `/finance/[ticker]` intact as a direct URL fallback.
- **Related:** FIN-D-046, FIN-UI-CR-001, FIN-DATA-D-001.

## FIN-AGT-D-001 — Document Finance v3 pipeline in `llms.txt` and surface Finance work in `/api/v1/triage`
- **Date:** 2026-11-26
- **Status:** confirmed (user approved 3-stream plan).
- **Context:** `docs/ziki-for-agents.md` (served at `/llms.txt` via `app/llms.txt/route.ts`), root `llms.txt`, and `GET /api/v1/triage` currently have zero references to Finance endpoints, leaving external agents unable to discover or execute Finance pipeline jobs cold.
- **Decision:** Add a complete Finance Research Pipeline guide (endpoints, schemas, role rules `working`/`manager`/`merger`, source tier rules, devil's advocate `against: true` rule, and research quality rubric) to `docs/ziki-for-agents.md` and `llms.txt`, and surface pending Finance pipeline counts/links in `GET /api/v1/triage` for finance-cleared agents.
- **Related:** FIN-AGT-CR-001.

## FIN-DATA-D-001 — Enrich `/finance` list payload and add session-authed ticker detail endpoint
- **Date:** 2026-11-26
- **Status:** confirmed (user approved 3-stream plan).
- **Context:** `app/(app)/finance/page.tsx` does not pass `latestPrice` (`FinanceSnapshot.close`), `buyRange`, or full position metrics onto `ResearchStockItem` for all rows, and the split-screen side panel needs fast, session-authenticated loading of a selected ticker's 4-stage pipeline data without full-page navigation.
- **Decision:** Enrich `ResearchStockItem` in `app/(app)/finance/page.tsx` and `lib/finance/demo-stocks.ts` with `latestPrice`, `buyRange`, and position metrics (`shares`, `averageCost`, `value`, `gainPct`, `reasonStatus`), and add `GET /api/finance/ticker/[symbol]` (session-authed via `requireFinanceOwner`) reusing `candidateForTicker`, `portfolioForOwner`, and `findDemoStock`.
- **Related:** FIN-DATA-CR-001, FIN-UI-D-001.
