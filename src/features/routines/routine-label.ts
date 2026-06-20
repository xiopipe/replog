/**
 * Routine label helpers for the weekly-plan strip (TKT-0054).
 *
 * The strip previously showed a single uppercase letter per routine, so a PPL
 * plan rendered "P P L" with Push and Pull indistinguishable. These helpers
 * give a 2–3 char abbreviation plus a stable per-routine color so every routine
 * in a plan is visually distinct even when abbreviations still collide.
 */

/**
 * Abbreviate a routine name to 2–3 characters.
 *  - multi-word  → initials, capped at 3 ("Full Body A" → "FBA")
 *  - single word → first two letters ("Empuje" → "Em", "Push" → "Pu")
 *  - ≤ 2 chars   → the full name, uppercased
 */
export function abbreviateRoutine(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed.toUpperCase();

  const words = trimmed.split(/\s+/);
  if (words.length > 1) {
    return words
      .map((w) => w.charAt(0))
      .join('')
      .slice(0, 3)
      .toUpperCase();
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.charAt(1).toLowerCase();
}

/**
 * Map each distinct routine id to a stable color from `palette`. Distinct ids
 * are sorted so the same routine always gets the same color within a plan,
 * regardless of which weekday it appears on.
 */
export function routineColorMap(
  routineIds: string[],
  palette: readonly string[],
): Record<string, string> {
  const distinct = [...new Set(routineIds)].sort();
  const map: Record<string, string> = {};
  distinct.forEach((id, i) => {
    map[id] = palette[i % palette.length];
  });
  return map;
}
