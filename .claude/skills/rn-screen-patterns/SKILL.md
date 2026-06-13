---
name: rn-screen-patterns
description: RepLog's screen patterns and design system (Expo Router, color/typography/spacing tokens, components, accessibility). Use it when building or adjusting any UI.
---

# UI patterns and design tokens — RepLog

Mobile app, **dark mode by default**, readable at arm's length. Clean, flat aesthetic (no gradients or decorative shadows).

## Tokens (base; refine when implementing the theme)
**Color**
- Accent / action: `#2F6FB0` (on light) — primary buttons, active states.
- Success: `#1D9E75` · Warning: `#85500B` (on `#FAEEDA`) · Error: `#A32D2D`.
- Primary muscle: `#D85A30` · secondary: `#F0997B` (muscle figure).
- Surfaces and text: define a neutral ramp for background, surface, border, primary/secondary/tertiary text that works in **dark and light**.

**Typography** (two weights: 400 and 500)
- Screen title 20 · section 16–17 · body 14–15 · label 11–12. Large logging numbers (≥15).

**Spacing**: multiples of 4 (8/12/16/24). **Radii**: 8 (md), 12 (lg). Touch targets ≥ 44px.

## Navigation
- **Expo Router** (file-based). Bottom tabs: Home · Routines · History · Settings.
- The tab bar **is hidden during the active session** (focused mode).

## Base components to build
`Button` (primary/secondary), `Card`, `SetRow` (editable weight/reps/RIR row), `MuscleFigure` (front/back figure from `exercise_muscles`), `Timer`, `EmptyState`, `Badge` (PR), `NumberStepper` (+/-), `TabBar`.

## Screen rules
- **Always** implement states: empty, loading, and error.
- Text via `t()` (skill `i18n`); data via local hooks (skill `legend-state-sync`).
- **Accessibility**: `accessibilityLabel`/`accessibilityRole` on controls, AA contrast, screen-reader support.
- Fast entry in logging: numeric keypad, +/-, duplicate previous set.

## Fidelity
Each MVP screen has a wireframe in `docs/specs/UI-Mockups/` (`home`, `active-session`, `routine-editor`, `history`, `weekly-plan`, `session-summary`, `exercise-detail`). Respect them in layout and hierarchy. Each one's narrative is in `docs/specs/Design-UX.md`.
