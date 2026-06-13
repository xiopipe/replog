# docs/ — agent contract only

This folder is **not** the documentation. It holds only the **agent contract** kept in the repo:

- **`constitution.md`** — immutable project principles + the mandatory English-only language policy.

Everything else (specs, tickets, decisions, state, roadmap, known issues) lives **only in the Obsidian vault** — the single source of truth:

```
~/Documents/Obsidian Projects/01 - Projects/Fitness Tracker/
```

See [`../AGENTS.md`](../AGENTS.md) for how agents read the vault and pick up work. The vault is outside git: it is present on the developer's machine and absent on a fresh clone / CI.
