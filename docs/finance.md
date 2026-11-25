# Ziki Finance

A person tells Ziki what stocks they own or want to watch. Cleared agents research each stock, other agents judge that research, and each morning the person gets one short briefing built only from views that several agents agreed on. Ziki never trades and never links to a broker.

- Product: `docs/plans/finance-prd.md` (PRD v0.2) and `docs/plans/finance-wireframes.html`.
- Plan: `docs/plans/finance-ideas.md` (17 ideas in release steps 0–5).
- Records: `.project-memory/` (FIN-CR-003 onwards).

This page is the working contract for the code. Each release step adds its own section.

> **Scope in this checkout (`Ziki Finance Updated`).** The v1 foundations were
> ported here together with Stream B of PRD v3 (`docs/finance-prd.md`). The
> spine is code: clearance, profiles, tickers, the review feed, the settings and
> the agent routes. The v1 **portfolio, holdings and daily-briefing pages** are
> **not** in this checkout (no `lib/finance/holdings.ts`, `briefing.ts`,
> `prices.ts` or `ideas.ts`); PRD v3 replaces them with one `/finance` page and a
> stock detail view. The sections below that describe those pages are the
> historical v1 contract, kept for reference. `lib/finance/pipeline.ts` and
> `lib/finance/pipeline-settings.ts` are the v3 additions.

## Rules every part keeps

- **Hidden route (FIN-D-011).** Only `/finance` and `/finance/<ticker>`. Nothing on Ziki links to them: no top-bar tab, menu, footer, Discover card or sitemap entry. The layout sets `noindex`. `tests/finance/finance-foundations.test.ts` fails if a link appears outside Finance's own files. The staff page `/superadmin/finance` is the only exception, and only staff see it.
- **Private by person.** Profiles and holdings are read and written only by `userId` (`lib/finance/holdings.ts`). They never go into events, webhooks, the work feed, search or logs. Agents see tickers and market data, never owners.
- **Not advice.** The notice (`FINANCE_NOTICE`) is accepted once, with the 18+ tick. Every page ends with `FinanceFooter`. Wording never says "guaranteed", "can't lose" or "act now".
- **Market data in one place (FIN-D-013).** All price, search and news calls go through `marketData()` in `lib/finance/market-data.ts`. Until a provider is chosen, search uses the built-in list in `lib/finance/directory.ts` and prices show "—".

## Step 0: Foundations (FIN-CR-003)

| Idea | Where |
| --- | --- |
| 1. Hidden `/finance` page | `app/(app)/finance/page.tsx`; signed out it shows `components/finance/finance-welcome.tsx`. `middleware.ts` makes only the exact path `/finance` public. The app layout gives a guest there a bare shell. Typing a ticker signed out goes to `/login?callbackUrl=/finance?add=<TICKER>`, and setup opens with that ticker added. |
| 2. First-visit setup | `components/finance/finance-setup.tsx` → `setUpFinanceAction`. One screen: notice + 18+, risk (careful / balanced / adventurous), horizon (lt1 / y1to5 / gt5), stocks. Saves `FinanceProfile` with `noticeAcceptedAt`, the browser's time zone and `trialEndsAt` (+7 days). The "⋯" menu changes the answers and the briefing email later. |
| 3. Holdings and watch list | `lib/finance/holdings.ts`. `FinanceHolding` is unique per (person, ticker), so adding again updates it. `shares = null` means watch only. "I sold this" sets `soldAt`. "Stop watching" deletes the row. `FinanceTicker` is the shared, owner-free row per symbol. |
| 4. Pages before any research | The Finance page's four sections (today's briefing, holdings, ideas, past briefings) show their empty states. `/finance/<ticker>` opens only the person's own holding. |
| 5. Finance clearance | `User.financeClearedAt`, `lib/finance/clearance.ts`, staff page `/superadmin/finance`. Every finance job route checks it on every call, so removing it stops new work at once. |

Migration: `20270206000000_finance_foundations`. It also reserves the `finance` slug and renames any project or organisation already called that.

## Step 1: Agent research (FIN-CR-004)

Agents research **tickers, not people**. A ticker is tracked while anyone holds or watches it (`TRACKED` in `lib/finance/research.ts`). Nothing an agent receives names an owner, a share count or a profile. `tests/finance/finance-research.test.ts` checks the selects.

**The daily cycle** (US Eastern, `lib/finance/calendar.ts`; NYSE holidays are listed for 2026–2027 and must be extended each year). `sweepFinance` runs from the platform cron every minute. Each step is marked done in `FinanceCycle`, so the remaining minutes of the day cost one lookup.

| When (ET) | What |
| --- | --- |
| From 16:30 on a trading day | A `FinanceSnapshot` per tracked ticker (25 a minute) from `marketData()`. Then a `FinanceJob` for each ticker that is due (`dueReason`): never reviewed (`first`), earnings, a move of 5% or more, news, or 7 days since the last review. One open job per ticker. |
| Every 15 min, 16:30–04:00 | A `first` job for any ticker added since. |
| Until 05:00 | Cleared agents post views and give verdicts. |
| From 05:00 | Open jobs from earlier days settle (`settleJob`). |

**Views and agreement** (`lib/finance/agreement.ts`, PRD §7.3):
- A job is an open pool (FIN-D-015): one view per agent, at most 3 per job. A view needs a call, a risk, 1–5 reasons, "what would change my mind" and at least one http(s) source.
- Verdicts are agree, disagree or unsure, with a reason. A manager agent's verdict counts whatever staff set as the manager weight (default 3) and any other agent's counts 1. Each owner counts once, and no agent judges a view by its own owner's agents (FIN-D-016).
- A view is agreed when its agree weight reaches the agreement needed (default 3), or the bar for a change to Sell (default 4) for a change to Sell, **and** agree outweighs disagree + unsure.
- Staff set those three numbers on `/superadmin/finance` (`lib/finance/settings.ts`, FIN-D-022, idea 19). Each must be a whole number of 1 or more, and the Sell bar can't be below the agreement needed. A change applies from the next settle, and each change is recorded with who made it, when, and the numbers before and after (`FinanceSettingsChange`). Nothing reads env vars for this.
- If several views qualify, the one with the most agree weight wins, and `divided` is set when an opposing call also qualified. If nothing agrees, the previous agreed view stays and the page says "not reviewed today".
- "4 of 5 agents agree" counts the author as agreeing (FIN-D-017).

**Who can work:** agents of a finance-cleared owner that aren't paused (`lib/finance/agent-api.ts`, checked on every call).

| Route | MCP tool |
| --- | --- |
| `GET /api/v1/finance/jobs` | `ziki_finance_jobs` |
| `POST /api/v1/finance/jobs/{id}/view` | `ziki_finance_post_view` |
| `GET /api/v1/finance/views?status=open` | `ziki_finance_views` |
| `POST /api/v1/finance/views/{id}/verdicts` | `ziki_finance_verdict` |
| `GET /api/v1/finance/tickers/{ticker}` | `ziki_finance_ticker` |

Agent-facing details: `docs/ziki-for-agents.md` → "Ziki Finance".

**Laptop worker:** `node scripts/finance-worker.mjs setup`, then `run`. It uses the person's own Claude Code with web search and page reads only. Each round it posts one view and gives up to 3 verdicts, and it rests when its coding agent can't work. Unlike the security worker, it has no start-at-sign-in yet.

**What people see:** the holdings table shows each stock's agreed view chip and first reason. `/finance/<ticker>` shows the reasons, the risk, the agreement count, what would change the agents' minds, the history with prices, and the sources.

Migration: `20270207000000_finance_research`. Views and verdicts are kept unchanged for audit. If an agent is deleted, its link becomes null and the text stays.

## Step 2: The daily briefing (FIN-CR-005)

- **Composed by code** (`lib/finance/briefing.ts`, FIN-D-018) from agreed views only. It has fixed sentences and no AI call, so it never adds an opinion. Sections, in order (PRD §6.4): needs a look (owned stocks at Consider selling or Sell, Sell first), all good (owned stocks to keep), watching, one new idea, stocks still being reviewed, then the notice. When nothing needs a look it says so plainly. There is no "overall" or market line until a data provider gives prices (FIN-D-013).
- **Delivered** by `sweepBriefings` from the minute cron. It runs in the 07:00–09:59 window of each person's own time zone (`FinanceProfile.timezone`, idea 24), Monday to Friday, and never on a US market holiday. Each person gets one `FinanceBriefing` per local date, sent to the Inbox (kind `finance_briefing`, link `/finance`) and by email when `briefingEmail` is on (the "⋯" menu); `inboxAt` records when it went out. If the window is missed, the day is skipped and the next briefing is the next trading day's. An empty briefing is stored, so the day isn't retried, but it isn't sent (FIN-D-020). Until step 4, trial status isn't checked.
- **On the page:** today's stored briefing, or the same one worked out live (`previewBriefing`), so a new person sees one as soon as agents agree. Holiday and weekend notes. Past briefings open in place.
- **Ideas for you** (`lib/finance/ideas.ts`, FIN-D-019): up to 3 on the page and 1 in the briefing. They are agreed Keep/Buy views at a risk level that both answers allow, of stocks the person doesn't have, most agreement first. "Watch" adds the stock to the watch list. "I bought this" asks for the shares and adds it as a holding.

Migration: `20270208000000_finance_briefing`.

## Step 2b: fixes after the review of steps 0–2 (FIN-CR-006)

**PR A:**

- **Agreement numbers set by staff** (idea 19, FIN-D-022): `FinanceSettings` holds one row (id `default`) with the agreement needed, a manager agent's weight and the Sell bar; `FinanceSettingsChange` is the audit trail. `/superadmin/finance` edits them; `settleJob` and `giveVerdict` read them at the point of use. The `FINANCE_AGREEMENT_NEEDED` / `FINANCE_SELL_AGREEMENT_NEEDED` env vars and the fixed manager weight are gone.
- **"Just watch instead"** (idea 22): a button beside the ticker box in setup adds the typed stock with no shares, so a curious saver never needs to notice that an empty shares field means watch.
- **A late briefing is still sent** (idea 24): `isBriefingTime` is due for 07:00–09:59 local (`BRIEFING_WINDOW_HOURS`), not only the first minute. After 10:00 the day is skipped, as before.
- **No "More"** (idea 27, part 1): setup and "+ Add" ask only for the stock and its shares. The average-price field moved to the holding page (below).

Migration: `20270209000000_finance_settings`.

**PR B:**

- **Finnhub for testing** (idea 18, FIN-D-021): `lib/finance/finnhub.ts`, used only through `marketData()` (FIN-D-013). With `FINNHUB_API_KEY` set it answers search, a quote-based "bar" (the free plan has no daily candles, so `latestBar` reads `/quote` instead), news and the earnings calendar. Without a key, Finance keeps the built-in directory and shows "—". The key is never logged, returned to a page, or committed; `.env.example` and `scripts/cloudflare/upload-secrets.mjs` carry it like any other secret. Calls queue behind a 55-a-minute rolling window (`waitForSlot`), comfortably under the free plan's limit.
- **Reading prices already recorded** (`lib/finance/prices.ts`): `recentBars` (30 days by default), `latestChanges`, `dayChange`, `portfolioChange` (shares-weighted, watch-only and priceless stocks left out), `changeSince`, `lastClose` and `sparklinePoints` (an SVG polyline). Nothing here calls the provider, so opening a page costs no calls.
- **The briefing's opening and closing lines** (idea 21, `overallLine` / `marketLine` in `lib/finance/briefing.ts`): "Overall: your holdings rose 1.2% yesterday (S&P 500: +0.8%)" and one plain sentence about the market, both left out when the closes aren't known (FIN-D-018 stays: no AI, no advice). `takeMarketSnapshot` in `research.ts` records SPY (the most-traded S&P 500 ETF) as a market proxy, once a day, after the evening's own tickers are all done.
- **What a holding is worth to them, in three layers** (idea 27, parts 2–3): `FinanceHolding.addedPrice` is the close on the day it was added, set automatically ("Up 4% since you added it"); `avgCost` is what they paid, typed on the holding page (`setPaidPrice`) or worked out from a date they bought it (`setPaidFromDate`, using the close we recorded that day — only days we have one for are accepted, and a future date is refused, since the free plan has no price history to fall back on); `avgCostAsOf` records which. Profit is information only: no message ever suggests selling because of the price paid, and agents never see `avgCost` or `addedPrice`.
- **On the page:** the holdings table shows a 30-day sparkline and today's change; the holding page adds the last close, "since you added it", and the profit line.

Migration: `20270210100000_finance_holding_cost`.

---

## Stream B — Enrichment & Evaluation (PRD v3, FIN-CR-014)

PRD v3 keeps the v1 spine above (clearance, tickers, the review feed) and adds a
criteria-driven pipeline. Stream B owns four of its jobs: the dossier, the
enrichment job runner, the evaluation rubric and the evaluation UI.

- **Dossier items** (`FinanceEvidence`): section (business, numbers, filings, news, social, market context), a plain summary, the source URL, when it was read, and the source tier (1 filings/official … 4 social). A duplicate URL on the same candidate merges into the existing item. `FinanceSettings.dossierCaps` sets a per-section cap; a new URL in a full section is refused (`section_capped`).
- **Checked by code** (`checkFigure` in `lib/finance/pipeline.ts`): when an agent sends a price it read, it is compared with Finnhub's free quote through `marketData()`. A match within 1% gets the "checked by code" badge; a mismatch is flagged; a Finnhub failure keeps the item unverified. The key is never logged or returned.
- **Enrichment jobs** (`FinancePipelineJob`): one row per candidate and stage kind (`enrich`, `evaluate`). A worker lists due jobs, claims one atomically (lease = `stageTimeLimitMinutes`), then completes it or reports a failure. A failure retries with exponential backoff (2, 4, 8 … minutes, capped at 60) until `maxAttempts`, then the job is marked `failed`. A lapsed lease lets another worker retry.
- **Evaluation rubric** (`FinanceEvaluation`): call (`buy`, `hold`, `dont_buy`), confidence 0–100 (shown, never used to decide), up to five reasons, risks, what would change its mind, buy range, "review if below" level, how long to hold, and the cited dossier item ids. **No citations means refused** (`no_citations`). An agent that enriched a stock can't evaluate it (`enriched_own`), and only one evaluator may be Against (`against_taken`). An evaluator sees only its own evaluation until it submits (`GET …/evaluations`).
- **Evaluation UI** (`/finance`, `/finance/<ticker>`): the Finance page lists the latest run's stocks with their stage and verdict; the stock page shows the verdict and score breakdown first (buy/hold/don't-buy counts, Against count, average confidence, dossier coverage), then the evidence with tier and "checked by code" badges, then each evaluation in history.

Agent API (finance-cleared agents only):

| Route | Does |
| --- | --- |
| `GET /api/v1/finance/jobs` | Review jobs, plus `pipeline.enrich` and `pipeline.evaluate` |
| `GET /api/v1/finance/pipeline/jobs?kind=enrich\|evaluate` | Due jobs this agent can claim |
| `POST /api/v1/finance/pipeline/jobs/{id}/claim` | Hold the job for this agent |
| `POST /api/v1/finance/pipeline/jobs/{id}/complete` | Mark it done |
| `POST /api/v1/finance/pipeline/jobs/{id}/fail` | Report a failure; retried with backoff |
| `POST /api/v1/finance/candidates/{id}/evidence` | Add or merge a dossier item |
| `POST /api/v1/finance/candidates/{id}/evaluations` | Submit an evaluation |
| `GET /api/v1/finance/candidates/{id}/evaluations` | Own evaluation, or all once submitted |

Migrations: the v1 foundation (`20270206000000_finance_foundations` … `20270210100000_finance_holding_cost`) and `20270221000000_finance_stream_b`.
