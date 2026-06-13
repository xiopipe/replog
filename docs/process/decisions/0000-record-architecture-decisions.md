---
status: accepted
date: 2026-06-13
decision-makers: [felipe]
---
# 0000. Record architecture decisions

## Context and Problem Statement

The vault captured the original spec interview as a flat log but had no durable, per-decision record going forward. We need decisions to be discoverable, dated, and traceable by both humans and AI agents.

## Considered Options

* MADR (Markdown Architectural Decision Records) — one file per decision.
* Keep appending to `Discussion-Decisions.md`.
* External tool (wiki, issue tracker).

## Decision Outcome

Chosen option: "MADR", because it is the 2026 industry standard, plain Markdown, Obsidian- and git-friendly, and keeps each decision atomic and dated. `Discussion-Decisions.md` is retained as the historical archive of the original 20 rounds.

### Consequences

* Good — every significant decision is one self-contained, linkable file.
* Good — agents can cite `process/decisions/NNNN-*.md` from tickets via `spec_refs`.
* Bad — minor discipline cost to write an ADR per decision.
