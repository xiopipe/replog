#!/bin/bash
# Stop-hook: AUTO-RUN the session-retro skill once per substantial session.
# Forces continuation via {"decision":"block","reason":...} + exit 0 (NOT exit 2).
# Two loop guards: (1) stop_hook_active (Claude Code's native re-entry flag),
# (2) a per-session marker written BEFORE blocking. Either one true => exit 0 silently.
# ponytail: line-count heuristic for "substantial"; tune RETRO_MIN_LINES if it fires too eagerly.

INPUT=$(cat)

# jq is needed to parse the hook payload; if absent, stay silent rather than error.
command -v jq >/dev/null 2>&1 || exit 0

# Guard 1: if we're already continuing because of a stop hook, never block again.
STOP_ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')
[ "$STOP_ACTIVE" = "true" ] && exit 0

SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty')
[ -n "$SESSION_ID" ] && [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ] || exit 0

# Guard 2: only auto-run once per session.
MARKER="/tmp/replog-retro-ran-${SESSION_ID}"
[ -f "$MARKER" ] && exit 0

# Only on a real work session, not a quick question.
RETRO_MIN_LINES=${RETRO_MIN_LINES:-180}
LINES=$(wc -l < "$TRANSCRIPT" 2>/dev/null | tr -d ' ')
[ "${LINES:-0}" -ge "$RETRO_MIN_LINES" ] || exit 0

# Write the marker FIRST, then force the retro. On the next Stop, guard 1 and/or 2 stop the loop.
touch "$MARKER"
jq -n '{
  decision: "block",
  reason: "Automatically run the session-retro skill now (.claude/skills/session-retro/SKILL.md): scan THIS session for corrected assumptions, stated user preferences, and new gotchas; de-dup against existing memory; save only the high-value, durable lessons to file memory (and dispatch vault-scribe for product/repo knowledge). If nothing is worth promoting, say so in one line. Then stop. Do not start any unrelated work."
}'
exit 0
