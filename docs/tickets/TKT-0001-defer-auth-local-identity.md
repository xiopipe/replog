---
id: TKT-0001
title: Defer auth — local anonymous identity + claim on registration
status: todo
phase: 6
labels: [auth, offline, data]
depends_on: []
spec_refs: ["../process/decisions/0001-defer-auth-local-identity.md", "../specs/Architecture.md", "../specs/Design-UX.md"]
created: 2026-06-13
---

## Context

Per [[0001-defer-auth-local-identity]], the app must stop forcing login. A local anonymous `user_id` is created on first launch; the app is fully usable offline; on formal registration the local data is claimed into the real account with no duplicates and no extra steps. Today `app/_layout.tsx` redirects to `/(auth)/login` when there is no session.

## Acceptance criteria (EARS)

- WHEN the user opens the app for the first time with no network THE SYSTEM SHALL generate a local `user_id`, apply defaults (Spanish, kg, RIR), and route directly into the app (no login screen).
- WHEN the user has a local identity THE SYSTEM SHALL read/write all data locally with sync OFF, using the same schema as an authenticated user.
- WHEN the user registers (email/Google) from Settings THE SYSTEM SHALL rewrite the local `user_id` to `auth.uid()` across all local rows, set `updated_at`, create the real `profile`, and enable sync.
- WHEN sync is enabled after a claim THE SYSTEM SHALL push all previously-local rows to Supabase with no duplicate rows and no conflict errors.
- WHEN the user is local (unregistered) THE SYSTEM SHALL present sign-in only as a non-blocking nudge, never as a gate.

## Implementation notes

- Entry gate: `app/_layout.tsx` `RootNavigator` (remove the mandatory redirect).
- Identity + session: `src/lib/auth.tsx`. Introduce a "local user" concept distinct from a Supabase session.
- Sync activation: `src/db/sync.ts`, `src/db/user-observables.ts` (sync stays OFF until claim).
- Claim/migration: atomic rewrite of `user_id` on every user-scoped table; create `profiles` row keyed to `auth.uid()`.
- Verify RLS still holds post-claim. Last-write-wins by `updated_at`.

## Out of scope

- The home screen redesign (see [[TKT-0002-hybrid-home-screen]]).
- Multi-device merge of two different local identities.
