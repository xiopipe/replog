---
description: Extract hardcoded visible text into the i18n system (es.json).
argument-hint: [optional file or folder]
allowed-tools: Read, Grep, Glob, Edit
---

Find **hardcoded** visible text in $ARGUMENTS (if empty, in the recent changes) and externalize it per the `i18n` skill:

1. Detect visible strings in JSX/TS (titles, buttons, labels, placeholders, error/empty messages).
2. Move them to `src/i18n/es.json` with **hierarchical keys** (`screen.element`).
3. Replace them with `t('key')`.
4. Apply correct number/unit formatting (kg/lb, decimals) via `Intl`.

No visible text should remain un-externalized. Report how many keys you added.
