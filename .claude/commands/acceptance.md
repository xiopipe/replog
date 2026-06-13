---
description: Check, point by point, the acceptance criteria of a Build Plan phase.
argument-hint: <phase number 0-5>
allowed-tools: Read, Grep, Glob, Bash
---

Read **Phase $1** in the vault's `08 - Build Plan/Build Plan.md` and evaluate its **acceptance criteria** against the current state of the code.

- Review the relevant code to confirm each point.
- Return a table: criterion → ✅ met / ❌ missing → evidence (`file:line`) or what's missing.
- If everything is met, declare the phase ready to advance; otherwise list the pending tasks in order.
