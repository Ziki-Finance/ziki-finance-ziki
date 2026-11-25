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
