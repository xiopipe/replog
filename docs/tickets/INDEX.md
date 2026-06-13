# Tickets — Board

> The work board. One `.md` per ticket in this folder (Backlog.md-compatible format). Statuses: `todo · in-progress · blocked · done · skipped`. Keep this table in sync with each ticket's frontmatter.

| ID | Title | Status | Phase | Depends on |
|---|---|---|---|---|
| [TKT-0001](TKT-0001-defer-auth-local-identity.md) | Defer auth — local anonymous identity + claim on registration | todo | 6 | — |
| [TKT-0002](TKT-0002-hybrid-home-screen.md) | Hybrid home screen (no mandatory login) | todo | 6 | TKT-0001 |
| [TKT-0003](TKT-0003-profiles-optional-fields-migration.md) | Add migrations for optional `profiles` fields | todo | 5 | — |
| [TKT-0004](TKT-0004-catalog-seed-expand.md) | Expand exercise catalog seed (~36 → ~60) | todo | 5 | — |
| [TKT-0005](TKT-0005-superset-dropset-ui-polish.md) | Superset/dropset visual grouping polish | todo | 5 | — |

## How to use

1. Pick a `todo` ticket whose `depends_on` are all `done`.
2. Read its body + EARS acceptance criteria; check linked specs/ADRs.
3. Set `status: in-progress` (here and in the file). Implement.
4. On completion: `status: done`, update `process/STATE.md`.

## Conventions

- ID: `TKT-NNNN`, file `TKT-NNNN-slug.md`.
- Phase 6 = post-MVP offline-first UX shift. Phases 0–5 map to the Build-Plan.
- New decisions → ADR in `process/decisions/`, linked from the ticket's `spec_refs`.
