---
description: Build a vault ticket end-to-end in its own git worktree + branch, ship via PR, merge, then remove the worktree (keep the branch).
argument-hint: TKT-NNNN [extra context]
---

Execute the full per-ticket lifecycle for **$1** following the `ticket-workflow` skill exactly. Invoke the `ticket-workflow` skill first and follow it step by step.

Ticket: **$1**  ·  Extra context: $ARGUMENTS

Steps (per the skill — do not skip or reorder):
1. Read the ticket file in the canonical vault: `/Users/felipe/Documents/Obsidian Projects/01 - Projects/Fitness Tracker/Tickets/$1-*.md`. Confirm scope (respect any downscoped "remaining slice" note). Dispatch `vault-scribe` to set it `status: in-progress`.
2. `git -C /Users/felipe/programming/fitrack fetch origin`, then create the worktree + branch: `git worktree add ../replog-trees/$1 -b ticket/$1-<slug> origin/main`.
3. In the worktree: symlink `node_modules` + `.env` from the main checkout and run `pnpm prepare` (so Husky hooks fire there).
4. Implement only what the ticket scopes — reuse tokens, i18n (Spanish, `src/i18n/es.json`), offline-first. Dispatch `ux-implementer`/`offline-data-engineer` into the worktree path if useful.
5. `pnpm verify` (lint + typecheck + test) — must be green.
6. Commit with a Conventional Commit `feat($1): …` (pre-commit hook runs the checks; never `--no-verify`).
7. `git push -u origin ticket/$1-<slug>` (pre-push runs tests).
8. `gh pr create --base main --head ticket/$1-<slug>` with a clear title/body.
9. `gh pr merge ticket/$1-<slug> --squash` — **never** `--delete-branch`.
10. Back on main: `git pull --ff-only`, then `git worktree remove ../replog-trees/$1` + `git worktree prune`. **Keep the branch** (verify it still exists).
11. Dispatch `vault-scribe` to mark the ticket `done` (Resolution note + PR link) and update `Tickets/INDEX.md` + `STATE.md`.

Use **pnpm** throughout (never npm/yarn). If anything fails a check, fix the cause — do not bypass hooks. Report: branch name, PR URL, merge result, confirmation the worktree was removed and the branch kept, and the vault update.
