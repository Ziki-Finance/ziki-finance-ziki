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

## FNC — Stream C
Now: implementation complete; final recheck and Finance CLI scenario running. Next action (complexity: medium): finish checks, commit and push current branch, open PR to Ziki-Finance/ziki-finance-ziki main. User explicitly requested PR soon. Dependency: PR #1 must merge first; C-only diff is against d63bbaa. Do not merge PR #1/#2, force-push, create a fork, reset a database, or deploy. See docs/finance-stream-c.md for contracts and smoke command. Local runtime/DB tooling is outside the clone in ../.local-tools. New DB is port 5434; old ziki-platform and old DB preserved. Cleanup left only a Windows-locked browser profile from the retired demo. No secrets committed. Update this section with the PR link and final check results.
