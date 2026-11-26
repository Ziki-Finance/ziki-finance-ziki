# Project memory

The continuity protocol is [`../PCP.md`](../PCP.md). Start a session by reading
`PROJECT.md`, `CURRENT_STATE.md` and `HANDOFF.md`.

## Workstream prefixes

| Prefix | Workspace | Notes |
| --- | --- | --- |
| `FIN-` | Ziki Finance | This folder's workstream (PRD v3, `docs/finance-prd.md`). |
| `INF-` | Infrastructure | Not used in this checkout yet. |

Each workstream edits only its own entries and its own section in
`CURRENT_STATE.md` and `HANDOFF.md`.

- FNC-: Stream C decision, portfolio and logging; own records only.

- `FIN-UI-`: Stream A — `/finance` Linear/spreadsheet list and split-screen side panel (`design-handoff/finance-split-panel-wireframe.html`).
- `FIN-AGT-`: Stream B — Agent discovery (`/llms.txt`, `docs/ziki-for-agents.md`, `/api/v1/triage`) and pipeline readiness.
- `FIN-DATA-`: Stream C — Live price/range/position data wiring, ticker-detail endpoint, and end-to-end verification.
