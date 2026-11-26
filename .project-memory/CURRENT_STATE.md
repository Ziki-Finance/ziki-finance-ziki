# Current state

_Updated 2026-11-26_

## Baseline (FIN / FNC)
- `/finance` (`app/(app)/finance/page.tsx`, `components/finance/finance-research-board.tsx`, `components/finance/portfolio-card.tsx`) currently renders a 4-card KPI strip at top, `Stock Research & Analysis` list (linking to `/finance/[ticker]`), collapsible `Criteria` right rail, and `PortfolioCard` at bottom.
- `/finance/[ticker]` (`app/(app)/finance/[ticker]/page.tsx`, `components/finance/finance-ticker-pipeline.tsx`) renders the stock header, `Your Position` / `Recommendation` card, and clickable 4-stage pipeline (`Screen → Enrich → Evaluate → Decide`).
- Finance backend v3 (`lib/finance/screen.ts`, `pipeline.ts`, `decisions.ts`, `portfolio.ts`, `monitor.ts`, and `/api/v1/finance/*` routes) is implemented and verified (`vitest run tests/finance`: 10/10 files, 96/96 tests).

## FIN-UI — Stream A: Split-Screen List & Side Panel
- Approved wireframe saved at `design-handoff/finance-split-panel-wireframe.html` (`FIN-UI-D-001`, `FIN-UI-CR-001`).
- Implementation not started (`FIN-UI-T-001`..`FIN-UI-T-003`).

## FIN-AGT — Stream B: Agent Discovery & Pipeline Readiness
- Audit complete: `docs/ziki-for-agents.md` (`/llms.txt`), `llms.txt`, and `GET /api/v1/triage` currently have zero Finance documentation or job discovery (`FIN-AGT-D-001`, `FIN-AGT-CR-001`).
- Implementation not started (`FIN-AGT-T-001`..`FIN-AGT-T-002`).

## FIN-DATA — Stream C: Live Data Wiring & Verification
- `ResearchStockItem` currently lacks `latestPrice`, `buyRange`, and inline position fields, and no session-authed `GET /api/finance/ticker/[symbol]` endpoint exists yet (`FIN-DATA-D-001`, `FIN-DATA-CR-001`).
- Implementation not started (`FIN-DATA-T-001`..`FIN-DATA-T-003`).
