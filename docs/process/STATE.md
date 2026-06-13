# Project State

> Single source of truth for **what is built**. Keep this current as tickets complete. Last updated: 2026-06-13.

## Summary

RepLog is a **complete MVP**. Build-Plan phases 0–5 are implemented; 72 unit tests pass; EAS Android build is configured. The work now is (a) the offline-first UX shift (defer auth, hybrid home) and (b) finishing the remaining gaps below.

## Build-Plan status (audit baseline)

| Phase | Area | Status | Evidence / notes |
|---|---|---|---|
| 0 | Foundations (scaffold, deps, TS strict, Supabase schema+seed, i18n, auth, Legend-State sync, dark theme) | DONE | `app/_layout.tsx`, `tsconfig.json` strict, `supabase/migrations/*`, `src/lib/i18n.ts`, `src/db/*`, `src/lib/theme.ts` |
| 1 | Exercise catalog (list/search/filter 8 groups, create custom, detail + muscle figure + best e1RM) | DONE | `app/catalog/*`, `src/features/catalog/*` |
| 2 | Routines & weekly plan (drag editor, fixed/flexible days, starter templates) | DONE | `app/routines/editor.tsx`, `app/plan/*`, `src/features/routines/templates.ts` |
| 3 | Session logging (focused walkthrough, timers, inline sets, ⋮ actions, PR detection, summary, retroactive) | DONE | `app/session/*`, `src/features/session/*` |
| 4 | History & settings (weekly grouping, exercise history, settings + optional profile) | DONE | `app/(tabs)/history.tsx`, `app/(tabs)/settings.tsx`, `app/catalog/[id].tsx` |
| 5 | Polish & release (empty states, i18n, dark mode, a11y, util tests, EAS) | DONE | `src/lib/__tests__/hypertrophy.test.ts` (72 tests), `eas.json` |

## Current focus

- **TKT-0001** — Defer auth: local anonymous identity + claim/migrate on registration.
- **TKT-0002** — Hybrid home screen (no mandatory login).

## Known pending / gaps

| Item | Ticket | Notes |
|---|---|---|
| Optional `profiles` fields not in migrations | TKT-0003 | Form + `updateProfile()` exist; migrations only cover unit/failure_metric. |
| Catalog seed ~36 (target ~60) | TKT-0004 | Works for demo; curation pending. |
| Superset/dropset visual grouping polish | TKT-0005 | Backend mutations exist; UI grouping needs clarity. |
| Maestro E2E | — | Optional per Build-Plan §5.3; not implemented. |

## Auth gating (as-is, pre-change)

`app/_layout.tsx` **requires** a session: no session → redirect to `/(auth)/login`. Cached session enables offline entry only **after** first online sign-in. No anonymous/local path yet. TKT-0001 changes this to local-first.

## Known issues

See `process/Known-Issues.md`. KI-001 (FK cascade ordering on sync) — fixed via backoff retry in `src/db/sync.ts`.
