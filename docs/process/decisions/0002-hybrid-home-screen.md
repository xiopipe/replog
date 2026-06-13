---
status: accepted
date: 2026-06-13
decision-makers: [felipe]
---
# 0002. Hybrid home screen as the initial screen

## Context and Problem Statement

With auth deferred ([[0001-defer-auth-local-identity]]), the first thing a brand-new user sees is no longer login. They have no plan or routine yet, but the goal is one tap to start using the product. What should the initial screen be?

## Considered Options

* **Classic Home** (current spec) — weekly strip + "Today's routine" card. Familiar, but an empty state pushes the user to create a plan before they can train.
* **Action hero** — a single large "Start workout" button → blank session instantly. Fastest, but loses weekly context.
* **Hybrid** — large "Start workout" at the top (blank session instantly; add exercises on the fly), plus shortcuts (repeat last, plan week) and a weekly strip below.

## Decision Outcome

Chosen option: "Hybrid", because it gives a new user the one-tap path to a live session while keeping the weekly context that veterans use. The blank-session flow relies on capabilities the data model already supports (add/modify exercises mid-session). Login becomes a non-intrusive nudge from Settings, never a gate.

### Consequences

* Good — meets the "one tap and you are training" goal without removing planning context.
* Good — works for an empty, brand-new local user and for an established one.
* Bad — slightly more layout than a pure hero screen. Tracked by [[TKT-0002-hybrid-home-screen]].
