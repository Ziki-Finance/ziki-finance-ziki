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


## Archived 2026-11-25 (before FIN-CR-015)

# Current state

_Updated 2026-11-23_

## FIN — Ziki Finance (PRD v3, Stream B)

**Exists now (written this session, unverified):**
- Finance foundations ported into this checkout: schema + migrations (`20270206000000_finance_foundations` … `20270210100000_finance_holding_cost`), `lib/finance.ts` and `lib/finance/{calendar,directory,finnhub,market-data,agreement,research,settings,clearance,agent-api}.ts`, the v1 agent routes under `app/api/v1/finance/`, the staff page `/superadmin/finance`, `docs/finance.md`, and the v1 finance tests.
- Stream B (FIN-CR-014): `lib/finance/pipeline.ts`, `lib/finance/pipeline-settings.ts`, schema for `FinanceRun`, `FinanceCandidate`, `FinanceEvidence`, `FinanceEvaluation`, `FinancePipelineJob`, migration `20270221000000_finance_stream_b`, `/finance` and `/finance/<ticker>` pages, and `tests/finance/finance-pipeline.test.ts`.


---
## Archived 2026-11-26

# Current state

_Updated 2026-11-25_

## FIN — Ziki Finance (UI/UX Redesign, FIN-CR-015)

**Exists now:**
- `/finance` (`app/(app)/finance/page.tsx`, `components/finance/finance-research-board.tsx`, `components/finance/finance-criteria-manager.tsx`, `components/finance/portfolio-card.tsx`):
  - `max-w-7xl` research-first command center with 4-card KPI strip (`Portfolio value`, `Needs your call`, `Researched universe`, `Active criteria`).
  - `Stock Research & Analysis` at the top with verdict filter tabs (`All`, `Needs you`, `Go / Keep`, `In progress`, `Not now`), search, ticker monograms, and links to `/finance/[ticker]`.
  - Collapsible `Saved Criteria` side rail (expanded via `Criteria (N)` toggle in the header; `Stock Research & Analysis` spans full width when collapsed); text-first `New / Edit research criteria` modal with clickable prefilled chips (`Quality at a fair price`, `Steady dividend growers`, `Long-term growth leaders`). Raw `Agent API` paths hidden from the investor UI.
  - `Portfolio` below with neutral border (`border-zk-border`), allocation bars, separated `Value` and `Gain / S&P 500`, neutral slate `Not checked yet` pill, soft `Next check` pills, and row links to `/finance/[ticker]`.
- `/finance/[ticker]` (`app/(app)/finance/[ticker]/page.tsx`, `components/finance/finance-ticker-pipeline.tsx`):
  - Stock header with `+ Log a trade (SYMBOL)` button.
  - Priority `Your Position` card (when held: value, shares & avg cost, gain, S&P 500, thesis health, `Ask for fresh check`) or `Recommendation` card (when not held).
  - Clickable 4-stage research pipeline (`1. Screen → 2. Enrich → 3. Evaluate → 4. Decide`) displaying each stage's backing data.

**Verified:**
- `vitest run tests/finance`: 10 files passed (96/96 tests).
- `eslint` on all 6 modified/created Finance UI files: 0 errors, 0 warnings.

## FNC — Stream C
Implemented PRD jobs 9–12 on branch feat/finance-stream-c-decision-portfolio, based on PR #1 d63bbaa. Three additive migrations; all 259 applied to isolated port-5434 database, old database unchanged. Full verify: lint/typecheck pass, 2435/2437 unit tests passed. Version 0.1.265.


## Archived 2026-11-27 from CURRENT_STATE.md

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

## Archived 2026-11-27 from CURRENT_STATE.md
# Current state

_Updated 2026-11-27_

## Baseline (FIN / FNC)
- `/finance` (`app/(app)/finance/page.tsx`, `components/finance/finance-research-board.tsx`, `components/finance/portfolio-card.tsx`) currently renders a 4-card KPI strip at top, `Stock Research & Analysis` list (linking to `/finance/[ticker]`), collapsible `Criteria` right rail, and `PortfolioCard` at bottom.
- `/finance/[ticker]` (`app/(app)/finance/[ticker]/page.tsx`, `components/finance/finance-ticker-pipeline.tsx`) renders the stock header, `Your Position` / `Recommendation` card, and clickable 4-stage pipeline (`Screen → Enrich → Evaluate → Decide`).
- Finance backend v3 (`lib/finance/screen.ts`, `pipeline.ts`, `decisions.ts`, `portfolio.ts`, `monitor.ts`, and `/api/v1/finance/*` routes) is implemented and verified (`vitest run tests/finance`: 10/10 files, 96/96 tests).

## FIN-UI — Stream A: Split-Screen List & Side Panel
- Approved wireframe saved at `design-handoff/finance-split-panel-wireframe.html` (`FIN-UI-D-001`, `FIN-UI-CR-001`).
- Implementation not started (`FIN-UI-T-001`..`FIN-UI-T-003`).

## FIN-AGT — Stream B: Agent Discovery & Pipeline Readiness
- Implemented and verified (`FIN-AGT-CR-001`, `FIN-AGT-T-001`..`FIN-AGT-T-002`): `docs/ziki-for-agents.md` (`/llms.txt`) and `llms.txt` document the full Finance v3 pipeline (endpoints, schemas, `User.financeClearedAt`, `working`/`manager`/`merger` role rules, independence & `against: true` rules, source tiers 1–4, and research quality rubric).
- `GET /api/v1/triage` (`app/api/v1/triage/route.ts`, `lib/finance/triage.ts`) surfaces a `finance` summary block (`cleared`, `jobsUrl`, `totalPending`, `counts`) for finance-cleared agents and omits it otherwise.
- Verified with `tests/finance/finance-triage-docs.test.ts` (6/6 passed) and ESLint (0 errors/warnings on Stream B files).

## FIN-DATA — Stream C: Live Data Wiring & Verification
- `ResearchStockItem` currently lacks `latestPrice`, `buyRange`, and inline position fields, and no session-authed `GET /api/finance/ticker/[symbol]` endpoint exists yet (`FIN-DATA-D-001`, `FIN-DATA-CR-001`).
- Implementation not started (`FIN-DATA-T-001`..`FIN-DATA-T-003`).

## Archived 2026-11-27 from CURRENT_STATE.md
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
