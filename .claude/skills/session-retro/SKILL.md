---
name: session-retro
description: Capture what was learned this session into durable memory so the same mistake never happens twice. Use at the end of any substantial work session, whenever the user corrects you or expresses a preference, when a wrong assumption gets disproven, when a new gotcha/discovery surfaces, or when the user says "session-retro", "retro", "capture learnings", "qué aprendimos", "save what you learned", or asks how to learn from each session. Run it before declaring a big task done.
---

# Session retro — turn this session's lessons into durable memory

The goal is narrow and important: a lesson learned once must never be re-learned. This session you (the assistant) implemented real work and discovered real things — some of which contradicted earlier assumptions. Capture the high-value signal and **route each lesson to the place that will actually surface it next time**, so a future session doesn't repeat the mistake.

Quality over volume: most of what happens in a session is not worth saving. Aim to promote only the ~15–25% that is durable and would change future behavior. Saving noise makes recall worse, not better.

## Step 1 — Scan the session for three buckets

Re-read the session with these lenses:

1. **Wrong assumptions I made and had to correct.** The strongest signal. Example from a real RepLog session: repeatedly telling the user "apply these migrations to Supabase manually" when a GitHub↔Supabase pipeline already auto-applied them on merge — disproven by `supabase db push --dry-run` → "Remote database is up to date." That single correction is worth more than ten "we did X" notes.
2. **User corrections and stated preferences.** Anything the user pushed back on, reworded, rejected, or asked you to do differently — and *why*. ("No dejes tickets sin decisión; márcalos `triage`.")
3. **New gotchas / discoveries.** Non-obvious facts that cost time: a stale-cache trap, a tooling quirk, an env fact, a workflow constraint.

## Step 2 — Filter and de-duplicate

For each candidate, assign a confidence: **high** (verified, will recur), **medium** (likely, partially verified), **low** (one-off or a guess). Before saving, run `mem_search` and check `MEMORY.md` so you update an existing memory instead of creating a duplicate. Drop low-confidence one-offs — note them in your summary but do not enshrine a guess as fact. If a "lesson" is something the repo already records (git history, CLAUDE.md, existing code), don't re-save it; save only what was non-obvious.

## Step 3 — Route each kept lesson to its home

Pick the destination by *what kind* of lesson it is — not everything goes to the same place:

| Lesson type | Where it lives | How |
|---|---|---|
| Durable cross-session fact (infra, tooling, env, workflow, gotcha) | engram + file memory | `mem_save` (type matching the fact) **and** a one-line pointer in `~/.claude/projects/.../memory/MEMORY.md` + a memory file |
| Product / repo knowledge: a defect, a behavior change, a decision (ADR), scope | the Obsidian vault | dispatch **`vault-scribe`** (Known Issues / Decisions / STATE) — the vault is RepLog's source of truth |
| A behavioral rule for how you should work ("always / never / prefer X because Y") | feedback memory; if repo-wide, also the contract | `mem_save` as a `feedback` memory with **Why** + **How to apply**; if it should bind every agent, propose adding a line to `CLAUDE.md` / `AGENTS.md` |
| A reusable multi-step procedure that will recur | a skill | create or update a `.claude/skills/<name>/SKILL.md` |

A single lesson can have two homes — e.g. the migration discovery above is both a durable infra fact (engram + memory) **and** a behavioral rule ("before telling the user to apply migrations, verify with `supabase db push --dry-run`; RepLog auto-applies on merge"). Save both facets.

## Step 4 — Verify before you enshrine

Don't write a guess into durable memory. If a lesson asserts how the code/system behaves, confirm it (a command, a file read) before saving it as fact — a wrong memory is worse than none because it will be trusted later. Memories are point-in-time; phrase them so a future reader knows to re-verify file/line/flag references.

## Step 5 — Report what was captured

Tell the user, briefly: what you saved, where each piece went, and what you deliberately skipped as low-value. Keep it to a few lines. If nothing this session was worth promoting, say so plainly — an empty retro is a valid outcome, not a failure to find something.
