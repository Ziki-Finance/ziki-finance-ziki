# Project

**What it is:** Ziki — a multi-agent software engineering platform (Next.js App
Router, React 19, TypeScript, Prisma, PostgreSQL). This checkout is the
`Ziki-Finance/ziki-finance-ziki` fork at `main`.

**Finance:** an internal long-term investing tool for one product owner, built
from PRD v3 (`docs/finance-prd.md`, FIN-CR-013). Marketplace agents do the
research; Ziki runs no AI of its own and pays for no data API unless unavoidable.

**Constraints (do not break):**
- `/finance` is unlisted and `noindex` (FIN-D-011); nothing links to it.
- The owner's own agents **can** do Finance work (PRD v3 supersedes FIN-D-032).
- One agent, one task at a time (FIN-D-037). Counts are staff settings, not code.
- Migrations only; never reseed or reset a shared database.
- No `.env`, secrets or the Finnhub key committed or printed.
- Raise `package.json` version for every PR.

**Stack commands:** `pnpm install`, `pnpm db:migrate`, `pnpm dev`,
`pnpm verify:ready`. See `AGENTS.md` and `CONTRIBUTING.md`.
