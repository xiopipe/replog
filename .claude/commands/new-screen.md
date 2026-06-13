---
description: Scaffold a new screen (Expo Router + tokens + i18n + a11y), faithful to the wireframe.
argument-hint: <screen-name>
allowed-tools: Read, Grep, Glob, Edit, Write
---

Create the **"$1"** screen by delegating to the **ux-implementer** subagent.

Requirements:
- Route in `/app` with Expo Router.
- If a matching wireframe exists in the vault's `04 - Diseno & UX/Mockups/`, follow it faithfully.
- Design-system tokens (skill `rn-screen-patterns`); no magic values. Dark mode.
- All text via `t()` in `src/i18n/es.json` (skill `i18n`); zero hardcoding.
- Accessibility: labels, targets ≥ 44px, AA contrast.
- Implement empty, loading, and error states.
- Data via Legend-State observables (skill `legend-state-sync`).

When done, verify against the spec with `spec-guardian`.
