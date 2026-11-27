# Handoff

_Updated 2026-11-27_

**Global constraints (all streams):**
- Do not reseed or reset the database; migrations only.
- Keep `/finance` unlisted and `noindex` (`FIN-D-011`).
- Do not commit `.env` or the Finnhub key.
- If running streams in parallel, use separate git worktrees/branches per `PCP.md` §7.

---

## FIN-UI — Stream A: Split-Screen List & Side Panel

**Now:** Implemented in working tree (`components/finance/finance-research-board.tsx`, `app/(app)/finance/page.tsx`, `tests/finance/finance-ui-split-panel.test.tsx`). `tests/finance/finance-ui-split-panel.test.tsx:122` has a `tsc --noEmit` error (`preset: null` vs `FinanceCriteriaPreset`).
**Next action (complexity: low):** Fix the `preset` type in `tests/finance/finance-ui-split-panel.test.tsx:122`, update Stream A's `CHANGELOG.md`/`TASKS.md` statuses, and verify `pnpm typecheck`.

---

## FIN-AGT — Stream B: Agent Discovery & Pipeline Readiness

**Now:** Implemented in working tree (`docs/ziki-for-agents.md`, `llms.txt`, `app/api/v1/triage/route.ts`, `lib/finance/triage.ts`, `tests/finance/finance-triage-docs.test.ts`). `lib/finance/triage.ts:41` has a `tsc --noEmit` error (`PipelineAgent.level` optional vs `FinanceAgent.level`).
**Next action (complexity: low):** Fix `lib/finance/triage.ts:41` type compatibility, update Stream B's `CHANGELOG.md`/`TASKS.md` statuses, and verify `pnpm typecheck`.

---

## FIN-DATA — Stream C: Live Data Wiring & Verification

**Now:** `FIN-DATA-CR-001` is implemented and verified on unit/route tests (`tests/finance/finance-data-wiring.test.ts` + full `tests/finance`: 13/13 files, 110/110 tests) and ESLint. `app/(app)/finance/page.tsx`, `lib/finance/demo-stocks.ts`, `lib/finance/ticker-detail.ts`, and `app/api/finance/ticker/[symbol]/route.ts` have 0 TypeScript errors.
**Next action (complexity: low):** After Streams A and B fix their two `tsc --noEmit` errors, run a full `pnpm typecheck`, live browser/DB smoke check on `/finance` + `/api/finance/ticker/[symbol]`, and commit all three streams.
Resume: read `PCP.md`, then follow `HANDOFF.md` (`FIN-DATA`). Start with: run `pnpm typecheck` and verify `/finance` against a running dev server.
