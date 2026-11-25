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
