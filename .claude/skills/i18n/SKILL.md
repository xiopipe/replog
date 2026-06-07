---
name: i18n
description: RepLog's internationalization rules (react-i18next, Spanish default). Use it whenever you add, display, or review visible text.
---

# RepLog i18n

Spanish by default, ready for more languages. **No visible text is hardcoded.**

## Rules
1. Every visible string (titles, buttons, labels, placeholders, errors, empty states) goes through `t('key')`.
2. Keys are **hierarchical** by screen/element: `session.next_exercise`, `history.sets_by_group`, `common.save`.
3. The source is `src/i18n/es.json`. Adding a language = add `xx.json` with the same keys; nothing else in the code.
4. **Pluralization** via i18next's API (`_one`/`_other`), not by concatenation.
5. **Numbers and units** with `Intl.NumberFormat` per locale; respect the user's unit (kg/lb) and decimals (see skill `hypertrophy-formulas`).
6. No building sentences by concatenating variables; use interpolation (`t('k', { count })`).

## Setup
- `react-i18next` + `expo-localization` to detect the locale; fallback and default = `es`.
- Initialize i18n once at startup, before rendering navigation.

## When reviewing
If you find a literal string in JSX/TS, create a key for it in `es.json` and replace it. Leave no visible literal.
