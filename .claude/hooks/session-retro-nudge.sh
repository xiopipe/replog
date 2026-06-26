#!/bin/bash
# Stop-hook: nudge to run /session-retro once per substantial session.
# Non-blocking — emits additionalContext (exit 0), never blocks (never exit 2).
# ponytail: line-count heuristic for "substantial"; tune RETRO_MIN_LINES if it nudges too eagerly.

INPUT=$(cat)

# jq is needed to parse the hook payload; if absent, stay silent rather than error.
command -v jq >/dev/null 2>&1 || exit 0

SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty')
[ -n "$SESSION_ID" ] && [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ] || exit 0

MARKER="/tmp/replog-retro-nudged-${SESSION_ID}"
[ -f "$MARKER" ] && exit 0   # already nudged this session

# Only nudge on a real work session, not a quick question.
RETRO_MIN_LINES=${RETRO_MIN_LINES:-180}
LINES=$(wc -l < "$TRANSCRIPT" 2>/dev/null | tr -d ' ')
[ "${LINES:-0}" -ge "$RETRO_MIN_LINES" ] || exit 0

touch "$MARKER"
printf '%s' '{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"[session-retro] This has been a substantial session. Before wrapping up, consider whether anything was learned (a corrected assumption, a user preference, a new gotcha) and offer to run the session-retro skill to capture it into durable memory. Skip if nothing is worth promoting."}}'
exit 0
