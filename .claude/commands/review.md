---
description: Review the current diff with the code-reviewer agent.
allowed-tools: Bash, Read, Grep, Glob, Task
---

Current diff to review:

```
!`git --no-pager diff`
```

Staged:

```
!`git --no-pager diff --staged`
```

Pass these changes to the **code-reviewer** subagent and return findings grouped into **Blocking / Important / Minor**, each with `file:line` and a concrete suggestion. Pay special attention to offline-first, RLS, secrets, and i18n.
