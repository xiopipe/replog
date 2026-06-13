---
status: accepted
date: 2026-06-13
decision-makers: [felipe]
---
# 0003. Documentation-first process via the vault-scribe agent

## Context and Problem Statement

The vault is now well-structured (ADR [[0000-record-architecture-decisions]]), but structure alone does not guarantee it stays complete. We need every new feature, change, or decision to be documented the same way, every time, so any future developer (human or AI) knows exactly what to build. Relying on memory or ad-hoc notes is what caused the original "no one knows the state" pain.

## Considered Options

* **Agent (`vault-scribe`) + a mandatory documentation-first rule** — a specialized subagent produces the full artifact set (ADR + spec + tickets with EARS), dispatched proactively before coding.
* **Slash command only** (`/document`) — same agent, but only runs when a human explicitly invokes it. No guarantee it happens.
* **Automatic hook** — fire documentation generation on repo events. Fragile and context-blind; documentation requires judgement (what to split into tickets, what is a real decision).

## Decision Outcome

Chosen option: "Agent + mandatory rule", because it matches the project's existing agent-per-capability pattern and embeds the obligation in the constitution so it is enforced rather than hoped for. The agent carries the judgement a hook cannot; the rule makes it non-optional.

Mechanics:
- New agent `.claude/agents/vault-scribe.md` writes docs only (never app code): creates/updates specs, writes ADRs (MADR), generates tickets (EARS), updates `INDEX.md` and `STATE.md`, in English per the language policy.
- `constitution.md` §7.1 makes documentation-first mandatory and names `vault-scribe` as the tool.
- `AGENTS.md` and `CLAUDE.md` instruct every agent to **proactively dispatch `vault-scribe`** when the conversation produces new scope or a decision not yet in the vault, before writing code.
- No slash command (per user preference): the main agent detects the need and delegates to the subagent.

### Consequences

* Good — every new feature/decision is documented identically; the vault never drifts behind the code.
* Good — any AI or person can pick up `tickets/` and know what to do.
* Bad — a small upfront step before each feature; mitigated because `vault-scribe` automates it.
* Bad — depends on the main agent recognizing the trigger; the constitution rule + AGENTS.md instruction reduce the chance it is skipped.
