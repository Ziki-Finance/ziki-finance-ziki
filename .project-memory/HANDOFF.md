# Handoff

_Updated 2026-11-26_

**Global constraints (all streams):**
- Do not reseed or reset the database; migrations only.
- Keep `/finance` unlisted and `noindex` (`FIN-D-011`).
- Do not commit `.env` or the Finnhub key.
- If running streams in parallel, use separate git worktrees/branches per `PCP.md` §7.

---

## FIN-UI — Stream A: Split-Screen List & Side Panel

**Now:** Wireframe `design-handoff/finance-split-panel-wireframe.html` and change record `FIN-UI-CR-001` are approved. `app/(app)/finance/page.tsx` and `components/finance/finance-research-board.tsx` still have the 4 top KPI boxes, bottom `PortfolioCard`, and `/finance/[ticker]` row links.

**Next action (complexity: medium):** Implement `FIN-UI-CR-001` in `components/finance/finance-research-board.tsx` and `app/(app)/finance/page.tsx`: remove the 4 top KPI boxes and bottom `PortfolioCard`, render the Linear/spreadsheet-style `Owned` + `Recommendations` grouped list with bordered metric boxes, and wire row click to open the Company Detail (`FinanceTickerPipeline` + position/recommendation summary + `TradeButton` / `FreshCheckButton`) in the right split-screen rail (sharing the rail slot with Criteria). Verify with `vitest run tests/finance` and ESLint.
Resume: read `PCP.md`, then follow `HANDOFF.md` (`FIN-UI`). Start with: inspect `design-handoff/finance-split-panel-wireframe.html` and `components/finance/finance-research-board.tsx`.

---

## FIN-AGT — Stream B: Agent Discovery & Pipeline Readiness

**Now:** Audit confirmed `docs/ziki-for-agents.md` (`/llms.txt`), `llms.txt`, and `GET /api/v1/triage` do not mention `/api/v1/finance/*`. Change record `FIN-AGT-CR-001` is approved.

**Next action (complexity: medium):** Implement `FIN-AGT-CR-001`: add the complete Finance v3 Research Pipeline section (endpoints, schemas from `lib/validations/finance.ts` & `lib/finance/pipeline.ts` / `decisions.ts`, `User.financeClearedAt` & `working`/`manager`/`merger` role rules, `against: true` devil's advocate rule, source tiers, and research quality rubric) to `docs/ziki-for-agents.md` and `llms.txt`, and update `app/api/v1/triage/route.ts` to surface pending Finance pipeline counts for finance-cleared agents. Verify with `vitest run tests/finance` and new triage/docs tests.
Resume: read `PCP.md`, then follow `HANDOFF.md` (`FIN-AGT`). Start with: inspect `app/api/v1/finance/jobs/route.ts`, `app/api/v1/triage/route.ts`, and `docs/ziki-for-agents.md`.

---

## FIN-DATA — Stream C: Live Data Wiring & Verification

**Now:** `FIN-DATA-CR-001` is approved. `ResearchStockItem` needs `latestPrice`, `buyRange`, and position metrics, and the side panel needs `GET /api/finance/ticker/[symbol]`.

**Next action (complexity: medium):** Implement `FIN-DATA-CR-001`: enrich `ResearchStockItem` in `app/(app)/finance/page.tsx` and `lib/finance/demo-stocks.ts` with `latestPrice` (`FinanceSnapshot.close`), `buyRange` (`FinanceEvaluation`), and position fields (`shares`, `averageCost`, `value`, `gainPct`, `reasonStatus`); create session-authenticated `app/api/finance/ticker/[symbol]/route.ts` (`requireFinanceOwner`); and run `vitest run tests/finance`, lint/typecheck, and an end-to-end smoke check.
Resume: read `PCP.md`, then follow `HANDOFF.md` (`FIN-DATA`). Start with: inspect `app/(app)/finance/page.tsx` and `app/(app)/finance/[ticker]/page.tsx`.
