## Archived 2026-11-23 before Stream C

# Current state

_Updated 2026-11-23_

## FIN — Ziki Finance (PRD v3, Stream B)

**Exists now (written this session, unverified):**
- Finance foundations ported into this checkout: schema + migrations
  (`20270206000000_finance_foundations` … `20270210100000_finance_holding_cost`),
  `lib/finance.ts` and `lib/finance/{calendar,directory,finnhub,market-data,agreement,research,settings,clearance,agent-api}.ts`,
  the v1 agent routes under `app/api/v1/finance/`, the staff page
  `/superadmin/finance`, `docs/finance.md`, and the v1 finance tests.
- Stream B (FIN-CR-014): `lib/finance/pipeline.ts`, `lib/finance/pipeline-settings.ts`,
  schema for `FinanceRun`, `FinanceCandidate`, `FinanceEvidence`,
  `FinanceEvaluation`, `FinancePipelineJob` plus five enums, migration
  `20270221000000_finance_stream_b`, the evidence/evaluation/pipeline agent routes,
  the `/finance` and `/finance/<ticker>` pages, and `tests/finance/finance-pipeline.test.ts`.
- `finance` added to reserved project/org slugs; `User.financeClearedAt`,
  `Agent.financeViews` / `financeVerdicts` and `User`'s finance back-relations.

**Not done:**
- Nothing has been installed, migrated, typechecked, linted or tested. This
  checkout has **no `node_modules`**; verification was deliberately skipped
  (user: "code only for now"). CI is the first real gate.
- Not committed. Working tree holds every change on branch `feat/finance-stream-b`.

**Static review pass (2026-11-23, no tools run):**
- Fixed `overallVerdict`: any tie (including Buy level with Hold) now reads Hold.
- Fixed theme classes: `zk-good-*` does not exist; the theme uses `zk-ok-*`.
- A job whose lease keeps lapsing now stops being offered and fails once
  `attempts > maxAttempts` instead of retrying forever.
- Staff page error messages no longer collide: the action passes `section=`
  so `invalid_number` shows on the right form.
- Foundation test now asserts `/finance` needs sign-in (PRD v3), not the v1
  public page.
- Fixed a strict-TS `new Map(...)` tuple inference in the stock page.

**Known gaps:**
- Streams A and C (criteria, run creation, decisions, portfolio, monitoring) are
  not implemented. The `/finance` page reads runs but nothing creates them yet.
- The v1 briefing/holdings page and its libs (`briefing.ts`, `holdings.ts`,
  `prices.ts`, `ideas.ts`) were **not** ported; only the spine Stream B needs.
- `FinanceSettingsChange` still audits only the three agreement numbers.
