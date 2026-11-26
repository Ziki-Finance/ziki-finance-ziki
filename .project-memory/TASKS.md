# Tasks

| ID | Task | Status |
| --- | --- | --- |
| FIN-T-001 | Port the v1 Finance foundation (schema, migrations, spine libs, agent routes, staff page, docs, tests) | COMPLETED (unverified) |
| FIN-T-002 | Stream B job 5: dossier items, dedupe, caps, code-checked badge | COMPLETED (unverified) |
| FIN-T-003 | Stream B job 6: enrichment job runner with retry/backoff and status | COMPLETED (unverified) |
| FIN-T-004 | Stream B job 7: evaluation rubric, Against role, citation requirement | COMPLETED (unverified) |
| FIN-T-005 | Stream B job 8: evaluation UI (score breakdown, verdict, history) | COMPLETED (unverified) |
| FIN-T-006 | Stream B tests (pure pipeline rules) | COMPLETED (unverified) |
| FIN-T-007 | Install, migrate and run `pnpm verify:ready`; fix failures | NOT STARTED |
| FIN-T-008 | Open the PR into `zedu-hng/zedu-fe:dev` | NOT STARTED |

| FNC-T-001 | PRD job 9: decision engine and UI | COMPLETED |
| FNC-T-002 | PRD job 10: append-only trades and computed holdings | COMPLETED |
| FNC-T-003 | PRD job 11: portfolio and holding UI | COMPLETED |
| FNC-T-004 | PRD job 12: immutable audit and monitor | COMPLETED |
| FNC-T-005 | Isolated migrations, tests and review evidence | NOT STARTED |


| FIN-UI-T-001 | Remove 4 top KPI boxes and bottom `PortfolioCard` from `/finance` | NOT STARTED |
| FIN-UI-T-002 | Implement Linear/spreadsheet `Owned` + `Recommendations` list with bordered metric boxes | NOT STARTED |
| FIN-UI-T-003 | Implement unified right split-screen side panel (Company Detail + Criteria toggle) | NOT STARTED |
| FIN-AGT-T-001 | Document Finance v3 pipeline, schemas, roles, and quality rubric in `docs/ziki-for-agents.md` and `llms.txt` | NOT STARTED |
| FIN-AGT-T-002 | Surface Finance pipeline jobs in `GET /api/v1/triage` for finance-cleared agents + tests | NOT STARTED |
| FIN-DATA-T-001 | Enrich `ResearchStockItem` in `app/(app)/finance/page.tsx` and `lib/finance/demo-stocks.ts` with `latestPrice`, `buyRange`, and position metrics | NOT STARTED |
| FIN-DATA-T-002 | Add session-authed `GET /api/finance/ticker/[symbol]` endpoint for side-panel detail loading | NOT STARTED |
| FIN-DATA-T-003 | End-to-end verification (`vitest run tests/finance`, lint/typecheck, and agent-to-UI smoke check) | NOT STARTED |
