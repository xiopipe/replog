---
description: Verify the current work against the Obsidian vault specs using the spec-guardian agent.
argument-hint: [optional file or area]
allowed-tools: Read, Grep, Glob, Task
---

Use the **spec-guardian** subagent to verify that the implemented work meets the Obsidian vault specs.

Scope: $ARGUMENTS (if empty, verify the recent changes / the area you're working on).

Ask for a report with a verdict, deviations (`file:line` → spec → severity), and any violated domain rules. Don't fix anything yet: diagnosis first.
