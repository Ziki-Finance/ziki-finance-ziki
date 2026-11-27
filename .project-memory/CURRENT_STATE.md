# Current state

_Updated 2026-11-27_

## Baseline (FIN / FNC)
- Finance backend v3 (`lib/finance/screen.ts`, `pipeline.ts`, `decisions.ts`, `portfolio.ts`, `monitor.ts`, and `/api/v1/finance/*` routes) is implemented.
- `/finance/[ticker]` (`app/(app)/finance/[ticker]/page.tsx`, `components/finance/finance-ticker-pipeline.tsx`) renders the stock header, `Your Position` / `Recommendation` card, and clickable 4-stage pipeline (`Screen → Enrich → Evaluate → Decide`).
- `vitest run tests/finance` passes 13/13 files, 110/110 tests.

## FIN-UI — Stream A: Split-Screen List & Side Panel
- Implemented in working tree (`app/(app)/finance/page.tsx`, `components/finance/finance-research-board.tsx`, `tests/finance/finance-ui-split-panel.test.tsx`).
- Note: `tests/finance/finance-ui-split-panel.test.tsx:122` currently fails `tsc --noEmit` (`null` assigned to `FinanceCriteriaPreset`).

## FIN-AGT — Stream B: Agent Discovery & Pipeline Readiness
- Implemented in working tree (`docs/ziki-for-agents.md`, `llms.txt`, `app/api/v1/triage/route.ts`, `lib/finance/triage.ts`, `tests/finance/finance-triage-docs.test.ts`).
- Note: `lib/finance/triage.ts:41` currently fails `tsc --noEmit` (`PipelineAgent` vs `FinanceAgent` `level` optionality).

## FIN-DATA — Stream C: Live Data Wiring & Verification
- `FIN-DATA-CR-001` implemented (`FIN-DATA-T-001`..`FIN-DATA-T-003`):
  - `ResearchStockItem` in `app/(app)/finance/page.tsx` and `lib/finance/demo-stocks.ts` enriched with `latestPrice` (`FinanceSnapshot.close`), `buyRange` (`FinanceDecision` / `FinanceEvaluation`), and `position` (`shares`, `averageCost`, `value`, `gainPct`, `reasonStatus`, etc.).
  - `lib/finance/ticker-detail.ts` and `app/api/finance/ticker/[symbol]/route.ts` (`GET /api/finance/ticker/[symbol]`, `requireFinanceOwner`, `?demo=1`, 404 for unknown/invalid tickers) implemented and covered by `tests/finance/finance-data-wiring.test.ts`.
  - ESLint clean on all Stream C files; `vitest run tests/finance` passes 13/13 files (110/110 tests); Stream C files have 0 `tsc --noEmit` errors.
