# Ziki Finance — Product Requirements (PRD)

| | |
| --- | --- |
| **Status** | **Draft v3 — criteria-driven, owner-built** (FIN-CR-013) |
| **Date** | 2026-11-19 |
| **Owner** | The product owner (the only user; the super admin account, FIN-D-040) |
| **Builds on** | PRD v2 (`docs/plans/finance-prd-v2.md`, FIN-D-025 to FIN-D-042), wireframes v2 (`docs/plans/finance-wireframes-v2.html`, FIN-D-034), the v2 demo (FIN-CR-009, verified 2026-11-18), and the code already in `main` (release steps 0–2, step 2b PR A and B; contract: `docs/finance.md`) |
| **Decisions** | FIN-D-021 to FIN-D-042 in `.project-memory/DECISIONS.md` |

---

## 1. Summary

Ziki Finance is an **internal long-term investing tool for one product owner**, using his own portfolio and his own money.

The owner tells Ziki what kind of companies he's looking for (**criteria**). Marketplace agents then do the rest:

- **Criteria → Idea:** the moment the owner enters criteria, it is converted into work. Ideas are created for it — each idea is "look for a stock that matches this criterion."
- **Screen:** agents find stocks that match the criteria. If enough agents agree a stock actually matches, that stock becomes an **issue**.
- **Engine (enrich):** once it's an issue, agents enrich it — company details, financials, fundamental analysis, technical analysis, news, SEC filings, everything about that stock. Five agents by default; the owner can set the number.
- **Review / Evaluate:** different agents look at all the enriched data and judge whether the stock is worth buying. Each agent makes its own recognition.
- **Decide:** a manager-level agent (the Decider) consolidates — the pros, the cons, the votes — and gives a final **Go or No-go**, with reasons.
- **Trade log:** the owner can click a stock, see the short version and the full reasoning, then log a trade (bought/sold, how much, at what price, on what date).
- **Portfolio + monitoring:** the stocks the owner holds are tracked. On a daily basis every holding is checked — are they still fine, should we still hold, should we buy more or sell? A weekly check re-tests each reason. When a reason breaks, the Decider issues Keep / Trim / Sell with reasons and an alert.

**Ziki never trades, runs no AI of its own (FIN-D-028), and pays for no data API unless truly unavoidable (FIN-D-029). Agents gather data by browsing the web under polite-browsing rules.**

---

## 2. What changed from PRD v2

This PRD keeps PRD v2's direction (internal owner, criteria-driven, Go/No-go, trade log, portfolio monitoring, no Ziki AI, no paid APIs) and tightens the flow to match the owner's restated description:

- **Criteria auto-converts to ideas → issues.** The moment criteria is entered, ideas are created ("look for a stock that matches this"). When enough agents agree a stock matches, it becomes an issue. No voting on whether to accept the criteria itself — acceptance is automatic on entry.
- **Screen → Enrich → Evaluate → Review → Decide** are five explicit agent stages, each a job kind in the Finance work feed.
- **Portfolio tracking and logging are in V1** — not deferred to V2. Every holding has reason points, is checked weekly and after events, and every trade and every reason change is logged immutably.
- **Three builders, 12 jobs.** The work is split into three streams of four jobs each, so each of the three people owns one complete vertical. Each stream is designed to be handed off intact to a fourth person if one joins later.

---

## 3. Who does what

| Who | Ziki class | Does |
| --- | --- | --- |
| **Product owner** | a person (super admin, FIN-D-040) | Sets criteria, reads decisions, logs trades, watches the portfolio. His own agents are NOT restricted from Finance work. |
| **Staff** | super admin | Sets thresholds on the Finance page (researchers per stage, reviewers bar, candidate rule, dossier caps, time limits, balance share). |
| **Researchers** | marketplace agents | Screen, enrich, evaluate |
| **Reviewers** | marketplace agents (manager) | Combine evaluations, Go / No-go recommendation |
| **Decider** | marketplace agent (merger) | Final Go / No-go, with reasoning, levels and answer to the case against |

Rules (from PRD v2, all confirmed unless noted below):

- Finance belongs to no organisation. Settings live on the Finance page itself.
- **The owner's own agents CAN do Finance work.** There is no restriction on the owner's agents working on Finance (this supersedes FIN-D-032).
- **One agent, one task at a time.** An agent holds at most one Finance task at a time (FIN-D-037). But there is no restriction on multiple different agents working in parallel — two or more agents can each take a different task in the same stage.
- Agent counts are **slots**: Researchers 3 (screen), 3 (enrich), 5 (evaluate); Reviewers 3; one Decider. Counts are staff settings, not fixed in code (FIN-D-037, FIN-D-042).
- One agent never does two roles on the same stock in the same run (FIN-D-031).
- A stage moves on as soon as its quota is in (FIN-D-035). Stocks move independently.
- Long-term investing only (FIN-D-030). No paid data API unless unavoidable (FIN-D-029).
- Ziki runs no AI of its own (FIN-D-028). All reasoning comes from marketplace agents.

---

## 4. The flow

```
Owner: criteria ─► Screen ─► Enrich ─► Evaluate ─► Review ─► Decide ─► Owner acts ─► Portfolio + weekly monitor
```

Each stage is one or more **jobs** in the Finance work feed (`GET /api/v1/finance/jobs`, existing agent API pattern). Each stage writes its own record. A decision can always be traced back to its evaluations, its dossier items, their sources, and the criteria version that produced it.

### 4.1 Criteria (owner)
- Three suggested presets to start (e.g. steady dividend growers, quality at a fair price, long-term growth leaders), or the owner writes his own.
- Optional fine-tuning tags: company size, industries, leave-out, how many stocks (5 / 10 / 15, default 10).
- **Every run keeps the exact criteria it used.** Editing creates a new version and a new run; never changes a run that has already started.
- Starting research creates one **run**.
- The moment criteria is entered, ideas are created — each idea is "look for a stock that matches this criterion."

### 4.2 Screen (Researchers)
- One screening job per run, open to several Researchers (default 3 slots).
- Each Researcher browses public sources (screener websites, exchange listings, filings, company pages) and submits tickers with a one-line "why it fits" per criterion and sources.
- A candidate goes forward when at least 2 Researchers proposed it, or 1 proposed it and another confirmed it (staff-set).
- Where a criterion is numeric and Finnhub's free data has the figure (price, market cap, industry), code checks it and a failed check drops the candidate.
- Candidates are ranked by how many Researchers proposed them; the run keeps the top N ("how many stocks").
- Stocks the owner already holds are marked "you own it" and still go forward.

### 4.3 Enrich (Researchers)
- One enrichment job per candidate, open to several Researchers (default 3 slots). None of them screened that stock.
- Each Researcher adds **dossier items**: section, summary, source URL, time read, source tier.
- Sections: business, numbers, filings, news, social, market context.
- Source tiers: 1 = filings and official company pages; 2 = major financial news; 3 = other news/analysis; 4 = social.
- Any figure Finnhub's free data also has is compared automatically — match gets a "checked by code" badge, mismatch is flagged.
- Duplicate URLs are merged. Staff set caps per section.
- Enrichment ends when every section but social has at least one tier 1–2 item, or at a staff-set time limit.

### 4.4 Evaluate (Researchers)
- One evaluation job per candidate, **5 slots by default** (staff-set). None of the evaluators enriched that stock.
- One evaluator is assigned **Against**: its job is to find the strongest reasons not to buy.
- Independent: an evaluator can't see the other evaluations until it submits its own.
- Each evaluation contains: call (Buy / Hold / Don't buy — the Against evaluator may still say Buy), confidence (0–100, shown but never used to decide), up to 5 reasons, risks, what would change its mind, suggested buy range, "review if below" level, how long to hold, cited dossier IDs. **No citations means refused.**

### 4.5 Review (Reviewers)
- One review job per candidate, **3 slots by default** (staff-set).
- Each Reviewer reads the evaluations and dossier, gives Go or No-go with a short summary, and answers the Against evaluation in one line.
- **Bar (FIN-D-036):** at least **2 of 3 Reviewers say Go** (counted by head) for the stock to reach the Decider. Staff can raise to 3.
- 1–2 or 0–3 is No-go by review: recorded, shown in the run, never in "Needs you", Decider can't overrule.

### 4.6 Decide (Decider)
- One decision job per stock that passed review. Decider did not evaluate or review that stock.
- The Decider gives: Go or No-go; one plain sentence for the owner; 3–5 reasons; buy range, "review if below" level and how long to hold; what would change the decision; answer to the case against.
- On 3–0: Decider decides (normally Go; No-go only with explanation). On 2–1: weighs the reasons including the dissent, decides Go or No-go. Split always shown; Decider answers the dissent in writing.
- A **Go** lands in "Needs you" on Today and in the next briefing. A **No-go** stays visible under "Not now".

### 4.7 Owner acts
- Every decision has three buttons: **I bought this**, **Watch it**, **Not for me** (optional reason, which later runs' agents can read).
- **Log a trade:** Bought or Sold, any US stock, shares, price, date (default today's close). A trade is linked to the decision it came from, if any. A stock bought without a decision is marked "added by you" — it gets a dossier and a reason check in the next cycle.
- Holdings, average cost, value and gain since bought are worked out by code from the trade log.

### 4.8 Monitor (Researchers, Reviewers, Decider)
- Every holding has **reason points** (2–4 checkable points from the Go decision, e.g. "service contracts growing", "debt below 1× profit"). A stock "added by you" gets its points from its first check.
- **Weekly check (Monday):** a Researcher re-checks each point with new sources; each point gets a status (holding / breaking). A Reviewer sets the holding's status:
  - **Holds:** every point holds
  - **Weakening:** one point is breaking
  - **Broken:** the main point is breaking, or several are
- **Event checks** run straight away on: a new 8-K or other filing, a dividend cut, quarterly results, a close below the "review if below" level.
- **"Ask for a fresh check"** queues a check now.
- **When a reason breaks:** the Decider gives Keep / Trim / Sell with reasons. It lands in "Needs you" and sends an alert.
- **Balance:** when one industry is over the staff-set share (default 35%), the portfolio shows one plain sentence (code-calculated, no chart).

### 4.9 Today and the briefing (on the Finance page)

- **"Needs you"** — shown prominently on the Finance page when a decision needs the owner or a reason is breaking. Empty reads "Nothing needs you today."
- **Summary boxes on the page** — Portfolio value, Reasons still true, Research running.
- **Briefing:** weekdays at 07:00 local, in Inbox and email. **Built by code** from records — fixed sentences, no Ziki AI. Contains portfolio value and yesterday's move vs the S&P 500, "Needs you", reasons still true, research progress.
- **Alerts:** only when a reason breaks or a new decision needs the owner. **Never for daily price swings.**

---

## 5. The UI — one major page plus a detail view

The Finance UI is **one major page** (`/finance`) where most of the work happens, plus **one detail view** (`/finance/<ticker>`) for a single stock. There are no separate Today / Research / Decisions / Portfolio / Staff pages.

### 5.1 The Finance page (`/finance`) — one page

The page shows everything together:

- **Criteria entry** — a box where the owner enters criteria (preset or his own words), with optional tags (company size, industries, leave-out, how many stocks). Submitting starts a run.
- **Pipeline bar** — the current stage of each stock in the run (screen → enrich → evaluate → review → decide), shown as a build-pipeline style bar so a wait never looks broken. Counts are slots filled as agents become free.
- **Stock list** — one row per stock: ticker + company, current stage, decision (Go / No-go / pending), and a one-line reason.
- **Decisions** — Go / No-go with the plain-sentence verdict, 3–5 reasons, votes, the case against, and the buy range / "review if below" level / how long to hold.
- **Portfolio** — owned positions with value, gain vs the S&P 500, the Reason column (Holds / Weakening / Broken), and next check date.
- **Change log** — every trade and every reason change, with timestamp and actor.
- **Trade log** — a way to log a buy or sell (shares, price, date) for any stock, linked to the decision it came from if any.

Empty state reads "Nothing needs you today" when there's no active research and no holdings needing attention.

### 5.2 The stock detail view (`/finance/<ticker>`)

Clicking a stock opens the detail view for that single stock:

- **Verdict first, then the proof** — Go / No-go in one sentence, then the reasons, the votes (chips against the bar), the case against, and the research.
- **Full reasoning** — each agent's evaluation, the reviewer combination, the Decider's decision and answer to the dissent.
- **Evidence** — dossier items with section, summary, source URL, source tier, and "checked by code" badges where Finnhub's data matched.
- **Criteria version** — the exact criteria version that produced this decision, so it can always be traced back.

### 5.3 What is NOT in the UI

- No separate Today page, Research list page, Decisions list page, Portfolio page, Holding page, or Staff page — those are all sections on the one Finance page.
- No top-bar tab, menu item, footer link, Discover card or sitemap entry. `/finance` is reachable only by its URL and is `noindex` (FIN-D-011).

---

## 6. Data model (additions, proposed)

| Record | Holds |
| --- | --- |
| `FinanceCriteria`, `FinanceCriteriaVersion` | preset or own words, tags, version |
| `FinanceRun` | one research run: criteria version, stage, dates |
| `FinanceCandidate` | run × ticker: who proposed it, why it fits, code-check result, stage |
| `FinanceEvidence` | dossier item: ticker, section, summary, URL, read time, tier, code-checked |
| `FinanceAnalysis` | per lens per ticker per run: fundamentals, valuation, momentum, news sentiment, risk |
| `FinanceEvaluation` | call, confidence, reasons, risks, change-mind, levels, cited evidence, Against flag |
| `FinanceReview` | Reviewer's Go / No-go, summary, answer to Against |
| `FinanceDecision` | Decider's Go / No-go (or Keep / Trim / Sell), sentence, reasons, levels, answer |
| `FinanceTrade` | bought / sold, ticker, shares, price, date, linked decision |
| `FinanceReasonPoint`, `FinanceCheck` | holding's checkable points; each check's status per point |
| `FinanceOwnerAction` | "I bought this" / watch / not for me (+ reason) |
| `FinanceSettings` | staff thresholds: researchers per stage, reviewers bar, candidate rule, dossier caps, time limits, balance share |

New job kinds in the existing feed: `screen`, `enrich`, `evaluate`, `review`, `decide`, `check`.

---

## 7. Jobs-to-do (exactly 12)

### Stream A — Criteria & Discovery (Person 1: Jobs 1–4)
1. **Criteria schema & validation** — Zod schema for finance criteria (preset or own words, tags, how many stocks) in `lib/validations/`.
2. **Criteria storage & API** — Prisma migration + `app/api/v1/finance/criteria` routes (create/read/update/delete), scoped to the owner, plus criteria versions.
3. **Criteria UI (form + list)** — shadcn form to create/edit criteria and a list view to view/delete them; gated with `PermissionBoundary`.
4. **Discovery / screen engine** — agents propose stocks matching criteria; candidate list persisted; code checks numeric criteria against Finnhub; a confirmed match becomes an issue.

### Stream B — Enrichment & Evaluation (Person 2: Jobs 5–8)
5. **Data connectors & dossier** — agents browse and add dossier items (section, summary, URL, tier); dedupe, caps, code-checked badges vs Finnhub.
6. **Enrichment job runner** — async enrichment jobs per candidate with retry/backoff and status tracking.
7. **Evaluation rubric & scoring** — evaluation call/confidence/reasons, the Against role, citation requirement ("no citations means refused").
8. **Evaluation UI** — score breakdown per candidate, fine/not-fine-style buy/hold/don't-buy verdict, evaluation history.

### Stream C — Decision, Portfolio & Logging (Person 3: Jobs 9–12)
9. **Decision engine & UI** — manager-level Go / No-go with reasoning, split handling (2–1), dissent answer; UI to view decisions ("Needs you" / "Not now").
10. **Portfolio model & storage** — Prisma model for decided positions and trades; holdings computed by code from the trade log.
11. **Portfolio UI** — list of owned positions with value, gain vs S&P 500, Reason column, next check; link to holding detail and change log.
12. **Change logging** — immutable append-only log of every portfolio change (trade, reason point status, decision change) with timestamp and actor; UI to view the log; weekly monitor check and event checks.

### Handoff design for a fourth person
Each stream owns a complete vertical (data model → API → UI). If a fourth person joins:
- Stream A can hand off **Discovery UI + run history** (part of job 4),
- Stream B can hand off **Enrichment status dashboard** (part of job 6),
- Stream C can hand off **Portfolio alerts / change-log export** (part of job 12).

The three streams stay intact; the fourth person takes a bounded, clearly scoped piece from any stream without breaking ownership.

---

## 8. Mapping to Ziki's issue model

Each job above is one Ziki issue. It flows:

**Idea → (verdicts) → Issue · Requires confirmation → (confirmations) → Issue · Open → (bid + award) → In progress → delivery → Done · Requires review → (test verdicts) → Done · Accepted → (merge review) → Merge · Ready to merge → (merge + deploy) → Live · On dev/staging/prod.**

The screen → enrich → evaluate → review → decide stages are **job kinds in the Finance work feed**, not new Ziki statuses. No new status-like labels are added — every finance issue uses `lib/issue-substatus.ts` `moveTo()` and the existing status/substatus map.

Criteria auto-converts to ideas on entry. Ideas for "look for a stock that matches this criterion" are created automatically; when enough agents agree a stock matches, it becomes an issue — no separate vote on whether to accept the criteria.

---

## 9. Alignment with Ziki constraints

- **One logical change per PR** — each job is its own PR when practical.
- **Feature branch** — all finance work happens on a feature branch off `main` (or the branch the fork ships from, agreed with the INF workstream); never pushed to `main` directly.
- **Migrations only** — new Prisma models get a migration; never reseed or reset a shared DB. One enum value per migration (per `AGENTS.md`).
- **No `.env` or secrets committed.** Finnhub key is a secret, never committed or printed.
- **`pnpm verify:ready` (lint + typecheck + tests) before the PR.**
- **Version bump** in `package.json` for every PR (CI gate).
- **PCP memory files** updated per session: `.project-memory/PROJECT.md`, `CURRENT_STATE.md`, `HANDOFF.md`, `DECISIONS.md`, `TASKS.md`, `CHANGELOG.md`.
- **Finance pages unlinked and `noindex`** (FIN-D-011). `/finance` only, no top-bar tab.
- **Ziki runs no AI of its own** (FIN-D-028). **The owner's own agents CAN do Finance work** — there is no restriction on them (this supersedes FIN-D-032). Marketplace agents work alongside the owner's agents.
- **Long-term investing only** (FIN-D-030). No trading, no broker link.
