## Archived 2026-11-23 before Stream C

# Handoff

_Updated 2026-11-23_

## FIN — Ziki Finance (PRD v3, Stream B)

**Now:** Stream B code is written (FIN-CR-014) on `feat/finance-stream-b` with the
v1 Finance foundation ported underneath it. Nothing is installed, verified or
committed.

**Next action (complexity: medium):** Verify the change. First `pnpm install`,
`docker compose up -d`, then `pnpm verify:ready` (lint + typecheck + unit suite).
Fix every failure in one pass, then `pnpm verify:recheck`. Expect type errors
around the ported v1 libs matching this newer base, and around the generated
Prisma client. After green, open the PR into `zedu-hng/zedu-fe:dev`.

**Open decisions:** none for Stream B. Streams A/C must reuse
`FinanceRun`/`FinanceCandidate`/`FinanceEvidence` rather than add parallel models.

**Blockers and risks:**
- `FIN-I-001`: no `node_modules` in this checkout, so nothing is verified.
- Ported v1 code is from a repo ~12 versions behind; shared modules may differ.

**Constraints:**
- Do not reseed or reset the database; migrations only.
- Keep `/finance` unlisted and `noindex`.
- Do not commit `.env` or the Finnhub key.

**Git:** branch `feat/finance-stream-b`, no commits yet, large uncommitted change.

**Details:** `docs/finance.md` (contract), `.project-memory/CHANGELOG.md`
(FIN-CR-014), `docs/finance-prd.md` (PRD v3).


---
## Archived 2026-11-26

# Handoff

_Updated 2026-11-25_

## FIN — Ziki Finance (FIN-CR-015)

**Now:** Finance UI/UX redesign (`FIN-CR-015`, `FIN-D-046`) is implemented on `ops/cloudflare-deploy`, verified with `vitest run tests/finance` (10/10 files, 96/96 tests) and ESLint on all 6 modified/created Finance UI files, and pushed to `origin/ops/cloudflare-deploy`.

**Next action (complexity: low):** Deploy `ops/cloudflare-deploy` and smoke-test `/finance` and `/finance/[ticker]` in the live environment.
Resume: read `PCP.md`, then follow `HANDOFF.md` (`FIN`). Start with: verify the deployed `/finance` command center and `/finance/[ticker]` detail page.

**Constraints:**
- Do not reseed or reset the database; migrations only.
- Keep `/finance` unlisted and `noindex` (`FIN-D-011`).
- Do not commit `.env` or the Finnhub key.

**Details:** `.project-memory/DECISIONS.md` (`FIN-D-046`), `.project-memory/CHANGELOG.md` (`FIN-CR-015`).

## FNC — Stream C
Now: implementation complete; final recheck and Finance CLI scenario running. Next action (complexity: medium): finish checks, commit and push current branch, open PR to Ziki-Finance/ziki-finance-ziki main.


## Archived 2026-11-27 from HANDOFF.md

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

## Archived 2026-11-27 from HANDOFF.md
# Handoff

_Updated 2026-11-27_

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

**Now:** `FIN-AGT-CR-001` (`FIN-AGT-T-001`, `FIN-AGT-T-002`) is COMPLETED and VERIFIED. `docs/ziki-for-agents.md` (`/llms.txt`), `llms.txt`, `lib/finance/triage.ts`, `app/api/v1/triage/route.ts`, and `tests/finance/finance-triage-docs.test.ts` are updated and passing.

**Next action (complexity: low):** Stream B is complete; proceed with Stream A (`FIN-UI-CR-001`) or Stream C (`FIN-DATA-CR-001`) and commit all Finance changes together when ready.

---

## FIN-DATA — Stream C: Live Data Wiring & Verification

**Now:** `FIN-DATA-CR-001` is approved. `ResearchStockItem` needs `latestPrice`, `buyRange`, and position metrics, and the side panel needs `GET /api/finance/ticker/[symbol]`.

**Next action (complexity: medium):** Implement `FIN-DATA-CR-001`: enrich `ResearchStockItem` in `app/(app)/finance/page.tsx` and `lib/finance/demo-stocks.ts` with `latestPrice` (`FinanceSnapshot.close`), `buyRange` (`FinanceEvaluation`), and position fields (`shares`, `averageCost`, `value`, `gainPct`, `reasonStatus`); create session-authenticated `app/api/finance/ticker/[symbol]/route.ts` (`requireFinanceOwner`); and run `vitest run tests/finance`, lint/typecheck, and an end-to-end smoke check.
Resume: read `PCP.md`, then follow `HANDOFF.md` (`FIN-DATA`). Start with: inspect `app/(app)/finance/page.tsx` and `app/(app)/finance/[ticker]/page.tsx`.

## Archived 2026-11-27 from HANDOFF.md
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
