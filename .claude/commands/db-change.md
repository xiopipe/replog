---
description: Propose and apply a schema change keeping docs/specs/sql and the spec in sync.
argument-hint: <change description>
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

Requested schema change: **$ARGUMENTS**

Delegate to the **offline-data-engineer** subagent and follow this order:
1. Review @docs/specs/Architecture.md and @docs/specs/sql/ to locate the change.
2. Propose the SQL migration: idempotent, RLS intact, uuid / `updated_at` / soft delete conventions.
3. Update `docs/specs/sql/` **and** `docs/specs/Architecture.md` (the spec must stay the truth).
4. Adjust the Legend-State observables and sync config.
5. Keep the model close to final (avoid big migrations).

Nothing destructive (dropping tables/columns or deleting data) without explicit confirmation.
