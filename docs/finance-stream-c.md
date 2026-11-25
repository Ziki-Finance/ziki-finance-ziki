# Stream C: decisions, portfolio and logging

This implements PRD jobs 9–12 on **PR #1**, `feat/finance-stream-b` at
`d63bbaa34e58a238812e6886f9fcd0d4fcdc76ee`. The owner selected that foundation.
PR #2 has overlapping run/candidate schemas and is not merged into this branch.
Merge PR #1 first; then bring `main` into this branch without force-pushing.
Review this stream against the PR #1 commit to isolate its changes.

- Review slots and the Go bar are frozen when evaluations reach quota, including
  an Against evaluation. Reviewers need manager class; the Decider needs merger
  class. Votes count by head. Rejected reviews cannot reach the Decider; passing
  splits require a written dissent answer. Confidence never votes.
- `/finance` and `/finance/<ticker>` are owner-only, unlinked and noindex. The
  existing Ziki header stays. Needs you and Not now display final decisions;
  evidence/evaluation history remains in the stock view. Criteria entry belongs
  to Stream A and is not duplicated here.
- Trades are an append-only ledger. Server actions authenticate the owner on
  every call. Per-owner/ticker transaction locks protect dated replays and
  concurrent sales; oversells roll back. Submission UUIDs make retries
  idempotent. Holdings and average cost are calculated from trades; legacy
  `FinanceHolding` quantity fields are a compatibility cache for Stream B.
- Legacy holdings migrate to explicit opening entries. Unknown historical costs
  stay unknown. SQL triggers refuse update/delete/truncate of trades, decisions,
  reviews, reason definitions/results, owner actions and the change log.
- Holdings have 2–4 checkable reasons and one main reason. Researcher, manager
  and merger monitor phases use independent agents and expiring claims.
  A main break or multiple breaks means Broken; one secondary break means
  Weakening. Keep/Trim/Sell decisions require owner action; Ziki never trades.
- The cron runner reconciles evaluation quotas and queues Monday, filing,
  earnings, dividend-cut and below-review checks. Fresh checks can be requested
  inside the holding card. Notifications are only for changed breaking reasons
  and new actionable decisions, never daily price moves.
- S&P 500 comparisons use matched SPY exposure from recorded benchmark prices.
  Missing historical prices, industries or market data render unavailable; no
  market values or industry facts are invented. Finnhub free quotes are latest
  available quotes, not a historical candle service. An API key is optional for
  local setup; without it the built-in listing directory and manual trade price
  work, while live prices/events remain unavailable.

## Agent operations

`GET /api/v1/finance/jobs` adds `pipeline.review`, `decide` and `check`.
Claim candidate work through the existing pipeline claim route. Read its
context with `GET /finance/candidates/<id>/reviews`, then submit to
`POST .../reviews` or `POST .../decision`. Monitor phases use
`POST /finance/checks/<id>` with `action` (`claim`, `check`, `review`, `decide`)
and a `payload` for submissions. All paths above are under `/api/v1`.
The corresponding CLI commands start with `finance-`; run `pnpm ziki --help`.
Clearance and the existing rate budget apply. Responses omit portfolio owners,
share counts, account values and trade history.

## Verification

Run `pnpm verify:ready` after the complete change; use `verify:recheck` for
repairs. `tests/finance/finance-stream-c.test.ts` covers decisive rules.
Run `pnpm test:cli finance` for the clearance scenario.

For actual PostgreSQL proofs, migrate a **separate localhost database ending
in `_smoke`**, set its `DATABASE_URL`, and run:

```sh
pnpm exec tsx scripts/dev/finance-stream-c-smoke.ts
```

The smoke test creates uniquely named synthetic records and never resets,
reseeds or deletes history. It refuses other database names/hosts. It proves
review rejection/splits, role independence, one task per agent, idempotency,
concurrent/backdated oversells, owner isolation, SQL immutability, and an
independent reason-check-to-Trim flow. Its fixture verdicts are test data.
