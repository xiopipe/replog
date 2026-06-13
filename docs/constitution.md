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

- The **single source of truth is the Obsidian vault** at `~/Documents/Obsidian Projects/01 - Projects/Fitness Tracker/`. Product documentation lives **only** there — it is not mirrored in this repo. On conflict between code and vault, the vault wins (or the vault is updated deliberately). The repo keeps only the agent contract (`docs/constitution.md`, `AGENTS.md`, `CLAUDE.md`).
- Pick up work from the vault's `Tickets/INDEX.md`; follow each ticket's EARS acceptance criteria.
- If something is undefined, **ask — do not invent**.
- Record significant decisions as ADRs in the vault's `Decisions/` folder (MADR format).
- Keep the vault's `STATE.md` current as work completes.

### 7.1 Documentation-first (MANDATORY)

Before implementing any **new feature, behavior change, or architectural decision**, it must first be captured in the **Obsidian vault** following the three-layer pattern: an **ADR** if a decision was made, a **spec** update if behavior/data changes, and **ticket(s)** with EARS acceptance criteria. Code that has no backing ticket is out of process.

The **`vault-scribe`** agent exists to produce this documentation. Whenever the work produces new scope or a decision not yet in the vault, **dispatch `vault-scribe` to document it before writing code**. This is not optional — it is how the project stays buildable by anyone, human or AI.
