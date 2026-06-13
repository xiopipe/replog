---
id: TKT-0002
title: Hybrid home screen (no mandatory login)
status: todo
phase: 6
labels: [ui, home, onboarding]
depends_on: [TKT-0001]
spec_refs: ["../process/decisions/0002-hybrid-home-screen.md", "../specs/Design-UX.md", "../specs/UI-Mockups.md"]
created: 2026-06-13
---

## Context

Per [[0002-hybrid-home-screen]], the initial screen is a hybrid: action-first with weekly context, working for a brand-new local user with no plan. Replaces the login-first entry.

## Acceptance criteria (EARS)

- WHEN the user lands on Home THE SYSTEM SHALL show a prominent "Start workout" action at the top.
- WHEN the user taps "Start workout" with no routine THE SYSTEM SHALL create a blank session and allow adding exercises on the fly.
- WHEN there is an in-progress session THE SYSTEM SHALL show "Resume" instead of/above "Start workout".
- WHEN the user has prior sessions THE SYSTEM SHALL offer "Repeat last workout".
- WHEN Home renders THE SYSTEM SHALL show the weekly strip with today highlighted and a "Plan week" shortcut.
- WHEN the user is an unregistered local user THE SYSTEM SHALL surface sign-in only as a non-intrusive nudge (e.g., a dismissible banner or a Settings entry).
- All visible text comes from i18n (`es.json`); no hardcoded strings.

## Implementation notes

- Screen: `app/(tabs)/index.tsx`.
- Reuse existing session-start and "repeat last" flows; the blank-session path already exists in the session feature.
- Follow `docs/specs/UI-Mockups.md` home wireframe and the hybrid layout from the ADR.

## Out of scope

- The identity/claim mechanics ([[TKT-0001-defer-auth-local-identity]]).
- New feature cards beyond the agreed layout (separate "features/fichas" brainstorm).
