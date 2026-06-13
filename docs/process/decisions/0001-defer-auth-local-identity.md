---
status: accepted
date: 2026-06-13
decision-makers: [felipe]
---
# 0001. Defer auth — local anonymous identity with seamless claim

## Context and Problem Statement

The app currently forces login: `app/_layout.tsx` redirects to `/(auth)/login` when there is no session, and the whole data layer filters by `user_id`. This contradicts the offline-first goal — a user should open the app and start training immediately, even on first launch with no network. We need an identity model that works offline from second zero and migrates cleanly when the user later registers, with no discrepancies and no extra steps.

## Considered Options

* **Local anonymous identity + claim on registration** — generate a local `user_id` on device; sync OFF; on formal registration rewrite `user_id` → real `auth.uid()` across all rows and enable sync.
* **Supabase anonymous auth** (`signInAnonymously`) — real cloud user from the start; but requires network on first launch, so it fails the offline-first test.
* **Skippable login** — keep login first but offer "continue without account"; same local identity under the hood, but login is still the first screen.

## Decision Outcome

Chosen option: "Local anonymous identity + claim on registration", because it is the only option that is fully usable offline on first launch and gives a frictionless, conflict-free upgrade path.

Mechanics:
- First launch generates a local `user_id` (uuid) on device. Sync is OFF. Defaults applied without asking: Spanish, kg, RIR.
- Local data uses the **exact same schema** as an authenticated user.
- On formal registration (email/Google from Settings): rewrite local `user_id` → `auth.uid()` on all rows (bump `updated_at`), create the real `profile`, enable sync, push everything up. Because nothing was ever synced before, there are **no duplicates or conflicts**.

### Consequences

* Good — true offline-first; one tap into the app; zero-friction, zero-discrepancy registration later.
* Good — RLS and the data model are unchanged; only the `user_id` value is rewritten on claim.
* Bad — until the user registers, local data is not backed up to the cloud.
* Bad — the claim/migration step must be implemented carefully (atomic rewrite, profile creation). Tracked by [[TKT-0001-defer-auth-local-identity]].
