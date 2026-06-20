---
name: ticket-workflow
description: RepLog's mandatory per-ticket development lifecycle — one git worktree + branch per ticket, PR, merge, then tear down (kill any Metro/dev server the worktree started, remove the worktree) but KEEP the branch. Use whenever you start, implement, or finish a vault ticket (TKT-NNNN). Enforces pnpm + Husky checks.
---

# Ticket workflow — one worktree + branch per ticket

Every vault ticket (`TKT-NNNN`) is built in its **own git worktree on its own branch**, shipped via a **PR that is merged**, after which the **worktree is removed but the branch is kept**. The package manager is **pnpm** (not npm). Husky runs the checks automatically; never bypass them with `--no-verify`.

## Invariants (do not violate)
- **One ticket = one worktree = one branch.** Never implement a ticket directly on `main`.
- **Branch off `origin/main`** (latest), always.
- **pnpm only.** `pnpm install` / `pnpm verify` / `pnpm <script>`. No `npm`/`yarn`.
- **Checks must pass.** Husky `pre-commit` runs `pnpm lint && pnpm typecheck && pnpm test`; `pre-push` runs `pnpm test`. Do not pass `--no-verify`.
- **After a clean merge: tear down — kill any Metro/dev server the worktree started, then remove the worktree, KEEP the branch.** Never `git branch -d/-D` the ticket branch; never `gh pr merge --delete-branch`.
- **Never leave a Metro/Expo dev server running after the ticket is done.** A dev server started from the worktree pins files (blocking `git worktree remove`) and holds port 8081. Always kill it as the first teardown step — scope the kill to the worktree, never a blanket `pkill expo`.
- Worktrees live in the sibling dir `../replog-trees/` (outside the repo, never committed).

## Lifecycle (per ticket)

Let `T=TKT-NNNN`, `SLUG=<short-kebab>`, `BRANCH=ticket/$T-$SLUG`, `WT=../replog-trees/$T`. `REPO` = the main checkout (`/Users/felipe/programming/fitrack`).

### 1. Mark in-progress + sync main
- `git -C "$REPO" fetch origin`
- **Audit first — the ticket may already be done.** Tickets created from a product review can already be implemented on `origin/main` (or shipped under another ticket). Before building, check: `git -C "$REPO" log --oneline origin/main | grep -i "$T"` and read the file(s) the ticket targets on `origin/main`. If the fix is already present, **do not create a worktree or a duplicate PR** — skip to step 11 and dispatch `vault-scribe` to close it as already-implemented (cite the commit/PR). The board lags reality when several agents work in parallel.
- In the vault, set the ticket `status: in-progress` (dispatch `vault-scribe`). When another agent may be active, tell `vault-scribe` to touch **only the ticket file** here, not `INDEX.md`/`STATE.md` — defer those to the close (step 11) so two agents don't clobber the shared index.
- **Coordinate:** `git -C "$REPO" worktree list` + `git branch -r | grep ticket` to see what another agent already has in flight; pick a ticket (and files) that don't collide.

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

### 10. Tear down — kill the dev server, then remove the worktree (branch stays)
First **kill any Metro/Expo dev server this worktree started** (it pins files → `git worktree remove` fails, and it holds port 8081). Scope the match to `$WT` so a dev server from another worktree is never touched:
```bash
# Stop this worktree's Metro/Expo (node bin path always contains the worktree path)
pkill -f "$WT/node_modules/.bin/expo" 2>/dev/null || true
pkill -f "$WT/node_modules/.*expo.*start" 2>/dev/null || true
# Optional: if THIS worktree owned the Metro port and it's now free of the above, confirm 8081 released
lsof -ti tcp:8081 2>/dev/null | xargs -r ps -o args= -p 2>/dev/null | grep -q "$WT" && echo "WARN: 8081 still held by $WT" || true
```
Then remove the worktree:
```bash
git -C "$REPO" switch main
git -C "$REPO" pull --ff-only origin main || true   # pick up the merged squash commit; see note below if this aborts
git worktree remove "$WT"                            # deletes the worktree dir only (use --force only if you just killed its dev server)
git worktree prune
```
Do **not** delete `$BRANCH`. Confirm it still exists: `git branch --list "$BRANCH"`.

> **If `pull --ff-only` aborts ("Not possible to fast-forward"):** local `main` has diverged from `origin/main` (e.g. unpushed local commits). This is **non-fatal and expected** — worktrees branch off `origin/main`, so removal and future tickets are unaffected. Do **not** force a rebase/merge to "fix" it mid-teardown (it can conflict in hot files). Skip the pull, finish teardown, and surface the divergence to the user as a separate decision.

### 11. Close the ticket in the vault
- Dispatch `vault-scribe` to set the ticket `status: done`, add a `## Resolution` note (files + PR link + verification), and update `Tickets/INDEX.md` + `STATE.md`.

## Notes & gotchas
- **Hooks in worktrees:** `core.hooksPath` is shared, but `.husky/_` is gitignored, so step 3's `pnpm prepare` is required for hooks to fire inside the worktree.
- **node_modules symlink** is safe because deps are identical across tickets (shared hoisted store). Only break the symlink + real-install when a ticket changes dependencies.
- **Branch kept, worktree gone** is the explicit requirement: history/PR is preserved on the branch; the working copy is cleaned up.
- Never `--no-verify`. If a check is wrong, fix the check, not the bypass.
- **Lint: 0 errors is the bar, not 0 warnings.** Husky `pre-commit` (eslint, no `--max-warnings`) fails only on **errors**. `origin/main` carries pre-existing warnings (e.g. `import/no-duplicates`, unused vars); don't chase them — just keep your own diff error-free and don't add new warnings.
- **React 19 hook-lint — sync `setState` in `useEffect` is an ERROR** ("Calling setState synchronously within an effect can trigger cascading renders"), so it fails `pre-commit`. To re-seed local input state when a prop changes, do **not** write an effect that calls the setters — remount instead with a `key` at the render site (e.g. `key={`${row.id}:${row.updated_at}`}`), which re-runs the `useState` initializers. See [[tkt-0011-active-time-timer]] memory.
- **Concurrent agents:** when two agents run tickets at once, both branch off `origin/main` independently (merge conflicts, not shared-state races, are the only risk — and they're resolvable). The real contention is the vault's `INDEX.md`/`STATE.md`: have `vault-scribe` **re-read immediately before editing** and make **minimal additive** changes; keep the in-progress flip (step 1) to the ticket file only.
- **Vault index lags reality.** When picking work, trust `origin/main` (merged PRs) over the board's `todo` status — a ticket marked `todo` may already be shipped (see step 1 audit).
