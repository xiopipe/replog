/**
 * formatDuration — human-readable, unit-labelled session duration.
 *
 * Replaces the ambiguous bare `NN:NN` rendering (which could read as h:mm or
 * mm:ss) at every duration *display* site (history list, session detail,
 * session summary). The live session timer keeps `formatMmSs` (SessionTimer),
 * where a running mm:ss clock is unambiguous by context.
 *
 * Output (always <= 2 units, so it fits one line on the history card):
 *   - >= 1 hour  → "1 h 35 m"   (seconds dropped; minutes zero-padded)
 *   - < 1 hour   → "5 m 08 s"   (seconds zero-padded)
 *   - zero/undefined (unfinished session) → "—"
 *
 * Unit labels come from i18n (`duration.*`) so non-Spanish locales localize.
 */
type Translate = (k: string, opts?: Record<string, unknown>) => string;

export function formatDuration(ms: number | null | undefined, t: Translate): string {
  if (ms == null || ms <= 0) return '—';

  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h >= 1) {
    return t('duration.hours_minutes', { h, m: String(m).padStart(2, '0') });
  }
  return t('duration.minutes_seconds', { m, s: String(s).padStart(2, '0') });
}
