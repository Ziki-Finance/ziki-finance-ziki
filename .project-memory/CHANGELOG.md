# Change records

## FIN-CR-014 — Finance v3 Stream B: enrichment, evaluation and their UI
- **Date:** 2026-11-23
- **Status:** APPROVED, IN PROGRESS (implemented, unverified).

**Problem.** `Ziki Finance Updated` had no Finance code. PRD v3 Stream B needs a
dossier, an enrichment job runner, an evaluation rubric and an evaluation UI,
none of which existed.

**BEFORE.** No Finance schema, migrations, libs, routes or pages in this checkout.

**PROPOSED AFTER.** Port the v1 Finance spine, then add Stream B:
- Dossier items (`FinanceEvidence`) with section, summary, URL, read time, tier;
  duplicate URLs merge, per-section caps, Finnhub price check with a badge.
- Retryable pipeline jobs (`FinancePipelineJob`) for enrich/evaluate: atomic
  claim with a lease, exponential backoff, status tracking.
- Evaluations (`FinanceEvaluation`) with call, confidence, reasons, risks,
  change-mind, levels, hold duration and cited dossier ids; no citations refused;
  one agent never enriches and evaluates the same stock; one Against evaluator.
- Evaluation UI: `/finance` pipeline list and `/finance/<ticker>` verdict, score
  breakdown, evidence and evaluation history.

**Approval.** User chose "Port foundations, then build B" and "No, code only for
now" (2026-11-23).

**Reason.** PRD v3 §4.3–4.4, §6, §7 (FIN-CR-013) define these four jobs; the PRD
builds on the v1 foundations that only existed in the older checkout.

**Benefits.** Streams A and C get shared candidate/evidence/job models instead of
inventing their own; agents get one feed for review, enrich and evaluate work.

**Risks and dependencies.** The ported v1 libs come from a checkout ~12 versions
behind and may need adaptation to this base. Nothing is verified (FIN-I-001).
Needs the v1 `FinanceSettings` row and a `FinanceRun`/`FinanceCandidate` created
by Stream A before the UI shows data.

**Acceptance criteria.**
- A finance-cleared agent can add a dossier item; a duplicate URL merges and a
  full section refuses a new URL.
- A price sent with an item is checked against Finnhub and badged or flagged.
- A pipeline job can be claimed, completed, and on failure retried with backoff
  until it fails.
- An evaluation with no cited dossier item is refused; an evaluator can't see
  others' evaluations until it submits; only one Against evaluator.
- The stock page shows the verdict, breakdown, evidence and history.

**Files affected.** `prisma/schema.prisma`; migrations `20270206…`–`20270210…`
(ported) and `20270221000000_finance_stream_b`; `lib/finance.ts`,
`lib/finance/{calendar,directory,finnhub,market-data,agreement,research,settings,clearance,agent-api,pipeline,pipeline-settings}.ts`;
`app/api/v1/finance/**`; `app/actions/finance.ts`;
`app/(app)/superadmin/finance/page.tsx`; `app/(app)/finance/**`; `docs/finance.md`;
`tests/finance/*`; `lib/project-slug.ts`; `package.json`.

**Statuses.**
- Approval: APPROVED (user, 2026-11-23).
- Implementation: DONE, not committed.
- Verification: NOT RUN. No `node_modules`; user chose code-only. First run of
  `pnpm verify:ready` is the next task.

**Static review (2026-11-23).** Fixed without running tools: verdict ties now
read Hold; `zk-good-*` classes changed to the real `zk-ok-*`; a lapsed job past
its attempt limit fails instead of retrying forever; staff-page errors carry a
`section` so both forms don't show the same message; the foundations test
expects `/finance` to need sign-in (v3) instead of being public; a `new Map`
tuple needed `as const` under `strict`.

## FNC-CR-001 — Decision, portfolio and logging (Stream C)
Date: 2026-11-23. BEFORE: PR #1 has enrichment/evaluation and read-only Finance pages, no decisions or trade ledger/monitor. PROPOSED/APPROVED AFTER: implement PRD jobs 9–12 on its contracts. User approved Stream C and selected PR #1. Benefit: traceable Go/No-go, owner-managed trade log, monitored reasons and audit trail. Risks: unmerged dependency and new financial calculations/migrations. Acceptance: review quorum counted by head, rejected candidates never Needs you, splits answered, isolated roles, append-only trade/reason/decision history with trusted actor, code-derived holdings and no oversell, private owner UI, weekly/event/manual checks, no automatic trading. Files: Finance schema/migrations/services/API/actions/UI/tests/docs/memory, package version. Approval APPROVED; implementation IN PROGRESS; verification NOT RUN.


FNC-CR-001 ACTUAL AFTER: decision/portfolio/audit/monitor vertical implemented on PR #1; owner-only actions and noindex UI; three migrations deployed to isolated local DB. Implementation COMPLETED. Full run 715a5fa88ed7: lint/typecheck pass, 2435/2437 tests; repaired two regressions. Targeted 2026-11-23T15-30-58-779Z: all phases pass, 72/72 tests. Separate PostgreSQL smoke passed. Final recheck/CLI/PR publication pending; no CI/build claim.


## FIN-CR-015 — Finance UI/UX redesign: research-first command center & stock detail pipeline
- **Date:** 2026-11-25
- **Status:** COMPLETED (ESLint clean on modified files; 10/10 Finance test files / 96 tests passed).

**Problem.** `/finance` buried researched stocks below a multi-field criteria form, leaked raw API paths inline, used misleading badge colors (`Not checked yet` in green, `Pending` in primary CTA blue), and `/finance/[ticker]` lacked the owner's position/thesis health and a clickable stage-by-stage view of the research pipeline.

**BEFORE.**
- `/finance`: `max-w-4xl` centered column; `FinanceCriteriaManager` form + saved list at top; raw `GET`/`POST` endpoints inline; `Stock Research and Analysis` below; `PortfolioCard` with `border-zk-accent`, inline sub-view for holdings, green `Not checked yet` pill, and solid-blue `Pending` pill.
- `/finance/[ticker]`: `DecisionCard` / header followed by flat `Evaluations`, `Evidence`, and `Evaluation history` sections, without `Your Position` or clickable pipeline stages.

**PROPOSED AFTER.**
- `/finance`: `max-w-7xl` command center with 4-card KPI strip; `Stock Research & Analysis` at the top with verdict filter tabs, search, and ticker monograms; right-hand `Saved Criteria` & `Recent Agent Activity` rail; text-first `New / Edit criteria` modal with clickable prefilled chips; `Portfolio` below with neutral border, allocation bars, separated `Value` / `Gain / S&P 500`, neutral slate `Not checked yet`, soft `Next check` pills, and links to `/finance/[ticker]`. Raw `Agent API` paths hidden from the page.
- `/finance/[ticker]`: Stock header with `+ Log a trade (SYMBOL)` and Watch/Not-for-me actions; priority `Your Position` card (if held, showing value, shares, gain, thesis health, and `Ask for fresh check`) or `Recommendation` card (if not held); clickable 4-stage pipeline (`1. Screen → 2. Enrich → 3. Evaluate → 4. Decide`) displaying each stage's real data.

**Approval.** Approved by user on 2026-11-25 ("yh dgo ahead").

**Files affected.**
- `app/(app)/finance/page.tsx`
- `app/(app)/finance/[ticker]/page.tsx`
- `components/finance/finance-criteria-manager.tsx`
- `components/finance/finance-research-board.tsx` (new client component for filterable research list + criteria modal/rail)
- `components/finance/finance-ticker-pipeline.tsx` (new client component for clickable 4-stage pipeline on `[ticker]`)
- `components/finance/portfolio-card.tsx`

**Statuses.**
- Approval: APPROVED (user, 2026-11-25).
- Implementation: COMPLETED (2026-11-25).
- Verification: `vitest run tests/finance` passed (10 files, 96/96 tests); ESLint passed on all 6 modified/created Finance UI files (0 errors, 0 warnings).
