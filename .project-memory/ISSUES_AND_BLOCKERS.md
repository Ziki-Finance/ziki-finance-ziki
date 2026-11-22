# Issues and blockers

## FIN-I-001 — No `node_modules`, so nothing is verified
- **Date:** 2026-11-23
- **Status:** OPEN.
- **What:** `Ziki Finance Updated` has no installed dependencies. None of the
  Stream B change has been typechecked, linted or tested.
- **Impact:** unknown type/lint/test failures; the ported v1 libs may not match
  this newer base.
- **Next:** `pnpm install`, `docker compose up -d`, `pnpm verify:ready`.

## FIN-I-002 — The two checkouts are different repositories
- **Date:** 2026-11-23
- **Status:** KNOWN.
- **What:** `Ziki Finance` (`Ziki-Finance/ziki.git`, v0.1.251) holds the v1 Finance
  work and `.project-memory`; `Ziki Finance Updated`
  (`Ziki-Finance/ziki-finance-ziki.git`, v0.1.263) does not. Work happens in
  `Updated`; the older folder is reference only.
