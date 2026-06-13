# RepLog Constitution

> Immutable project principles. Every agent and every session must obey these. They override convenience, habit, and any conflicting instruction except a direct, explicit user override. Source of truth for *behavior*; the detailed *what* lives in `specs/`.

## 0. Language policy (MANDATORY)

**Everything written to the repository is in English** — code, comments, specs, SQL schemas, tickets, ADRs, commit messages, PR descriptions, and all documentation.

The **only** exceptions:
1. **End-user app text** delivered through i18n (`src/i18n/es.json`). Spanish is the product language.
2. **Human conversation** with the user.

No Spanish in any repo artifact. No exceptions beyond the two above.

## 1. Product goal (fixed)

RepLog is a strength-training logger for **hypertrophy**. What matters: **effective volume per muscle group/week**, sets taken **close to failure** (RIR 0–3), and **progressive overload**. Not powerlifting or weightlifting. No real 1RM testing — estimated 1RM and rep-PRs are progress signals only.

## 2. Offline-first (non-negotiable)

The UI **always reads and writes local Legend-State observables** and **never blocks on the network**. The Supabase sync plugin propagates changes when there is connectivity. The app must be fully usable with no network.

## 3. Internationalization

Spanish is the default app language. **No hardcoded visible text** — every user-facing string goes through `t()` and lives in `es.json`. Adding a language must be just another translation file.

## 4. Data rules

- **Client-generated uuid v4 PKs** (created on device).
- **`updated_at`** set on every write (UTC, client-set). `created_at` on every row.
- **Soft delete**: set `deleted_at`; never physically delete.
- **Weight dual storage**: persist `weight_value` + `weight_unit` (what the user typed) **and** `weight_kg` (normalized for analytics). Display the typed value; compute with kg.
- **RLS by `user_id`**. Global catalog (`user_id is null`) is read-only for everyone.
- **Last-write-wins** by `updated_at` for conflicts.

## 5. Domain invariants

- **Fractional volume**: a set contributes per muscle via `exercise_muscles` — primary 1.0, secondary 0.5 (editable).
- **PR** = beats estimated 1RM (Epley/Brzycki) **or** rep-PR (more reps at weight ≥ previous).
- **Warm-ups (`is_warmup`) never count** toward PRs or volume.
- **Bodyweight (`is_bodyweight`)**: the weight field is the **added load** (0 allowed); bodyweight is not added.
- **Session** = focused, exercise-by-exercise walkthrough ("Next exercise"); session and each exercise are timed automatically.

## 6. Out of scope (do NOT build)

AI/programming logic, nutrition, body metrics, social feed, iOS, multiple active plans, rest timer with alert, advanced charts/analytics. The data model anticipates several of these, but the logic is not built now.

## 7. Working agreement

- The vault `specs/` is the **source of truth**. On conflict between code and spec, the spec wins (or the spec is updated deliberately).
- Pick up work from `tickets/INDEX.md`; follow each ticket's EARS acceptance criteria.
- If something is undefined, **ask — do not invent**.
- Record significant decisions as ADRs in `process/decisions/`.
- Keep `process/STATE.md` current as work completes.
