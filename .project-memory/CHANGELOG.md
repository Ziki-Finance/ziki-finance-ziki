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
