---
name: ticket-workflow
description: RepLog's mandatory per-ticket development lifecycle — one git worktree + branch per ticket, PR, merge, then remove the worktree but KEEP the branch. Use whenever you start, implement, or finish a vault ticket (TKT-NNNN). Enforces pnpm + Husky checks.
---

# Ticket workflow — one worktree + branch per ticket

Every vault ticket (`TKT-NNNN`) is built in its **own git worktree on its own branch**, shipped via a **PR that is merged**, after which the **worktree is removed but the branch is kept**. The package manager is **pnpm** (not npm). Husky runs the checks automatically; never bypass them with `--no-verify`.

## Invariants (do not violate)
- **One ticket = one worktree = one branch.** Never implement a ticket directly on `main`.
- **Branch off `origin/main`** (latest), always.
- **pnpm only.** `pnpm install` / `pnpm verify` / `pnpm <script>`. No `npm`/`yarn`.
- **Checks must pass.** Husky `pre-commit` runs `pnpm lint && pnpm typecheck && pnpm test`; `pre-push` runs `pnpm test`. Do not pass `--no-verify`.
- **After a clean merge: remove the worktree, KEEP the branch.** Never `git branch -d/-D` the ticket branch; never `gh pr merge --delete-branch`.
- Worktrees live in the sibling dir `../replog-trees/` (outside the repo, never committed).

## Lifecycle (per ticket)

Let `T=TKT-NNNN`, `SLUG=<short-kebab>`, `BRANCH=ticket/$T-$SLUG`, `WT=../replog-trees/$T`. `REPO` = the main checkout (`/Users/felipe/programming/fitrack`).

### 1. Mark in-progress + sync main
- In the vault, set the ticket `status: in-progress` (dispatch `vault-scribe`).
- `git -C "$REPO" fetch origin`

### 2. Create the worktree + branch
```bash
git -C "$REPO" worktree add "$WT" -b "$BRANCH" origin/main
```

### 3. Install deps in the worktree
A worktree has no `node_modules`/`.env` (gitignored). Do a real install (fast — pnpm hardlinks from the global store) and copy the env file:
```bash
cd "$WT"
cp "$REPO/.env" .env
CI=true pnpm install --frozen-lockfile   # deterministic tree; runs prepare → husky so hooks fire here
```
- **Do not symlink `node_modules`** — pnpm tries to purge a symlinked modules dir and aborts (no-TTY). A real install is the supported path.
- **`--frozen-lockfile`** is required: a non-frozen install re-resolves peers and the hoisted linker can hoist the wrong `jest-mock` major (→ `clearMocksOnScope is not a function`). The committed `overrides` + frozen lock keep it deterministic.
- `CI=true` avoids the interactive modules-purge prompt.
- If the ticket changes dependencies, drop `--frozen-lockfile`, run `pnpm install`, and commit the updated `pnpm-lock.yaml`.

### 4. Implement
- Read the ticket's EARS acceptance criteria from `…/Fitness Tracker/Tickets/$T-*.md`.
- Build only what the ticket scopes (respect downscoped "remaining slice" notes). Reuse design tokens, i18n (`src/i18n/es.json`, Spanish), offline-first patterns.
- You may dispatch `ux-implementer` / `offline-data-engineer` to do the coding **inside `$WT`** (pass them the worktree path).

### 5. Verify
```bash
pnpm verify   # lint + typecheck + test — must be green before committing
```

### 6. Commit (hooks enforce checks)
```bash
git add -A
git commit -m "feat($T): <summary>"   # Conventional Commit; pre-commit runs lint+typecheck+test
```
End the commit body with the standard `Co-Authored-By` trailer.

### 7. Push (pre-push runs tests)
```bash
git push -u origin "$BRANCH"
```

### 8. Open the PR
```bash
gh pr create --base main --head "$BRANCH" \
  --title "$T: <ticket title>" \
  --body "Implements $T. <what changed>. Verification: pnpm verify green.

Closes: vault ticket $T"
```

### 9. Merge — keep the branch
```bash
gh pr merge "$BRANCH" --squash   # NO --delete-branch
```
Wait for a clean merge (resolve checks/conflicts if any). Squash is the default strategy.

### 10. Remove the worktree (branch stays)
```bash
git -C "$REPO" switch main
git -C "$REPO" pull --ff-only origin main      # pick up the merged squash commit
git worktree remove "$WT"                        # deletes the worktree dir only
git worktree prune
```
Do **not** delete `$BRANCH`. Confirm it still exists: `git branch --list "$BRANCH"`.

### 11. Close the ticket in the vault
- Dispatch `vault-scribe` to set the ticket `status: done`, add a `## Resolution` note (files + PR link + verification), and update `Tickets/INDEX.md` + `STATE.md`.

## Notes & gotchas
- **Hooks in worktrees:** `core.hooksPath` is shared, but `.husky/_` is gitignored, so step 3's `pnpm prepare` is required for hooks to fire inside the worktree.
- **node_modules symlink** is safe because deps are identical across tickets (shared hoisted store). Only break the symlink + real-install when a ticket changes dependencies.
- **Branch kept, worktree gone** is the explicit requirement: history/PR is preserved on the branch; the working copy is cleaned up.
- Never `--no-verify`. If a check is wrong, fix the check, not the bypass.
