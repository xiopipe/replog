/**
 * Unit tests for src/lib/duration.ts (formatDuration).
 *
 * Acceptance: TKT-0052 — unit-labelled, unambiguous duration strings.
 */

import { formatDuration } from '../duration';

// Minimal stand-in for i18next's `t`, mirroring the es.json `duration.*` templates.
const t = (key: string, opts?: Record<string, unknown>): string => {
  const templates: Record<string, string> = {
    'duration.hours_minutes': '{{h}} h {{m}} m',
    'duration.minutes_seconds': '{{m}} m {{s}} s',
  };
  return (templates[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts?.[k] ?? ''));
};

describe('formatDuration', () => {
  it('renders >= 1 hour as "H h MM m" with seconds dropped and minutes padded', () => {
    expect(formatDuration((1 * 3600 + 35 * 60) * 1000, t)).toBe('1 h 35 m');
    expect(formatDuration((2 * 3600 + 5 * 60 + 59) * 1000, t)).toBe('2 h 05 m');
  });

  it('renders < 1 hour as "M m SS s" with seconds padded', () => {
    expect(formatDuration((5 * 60 + 8) * 1000, t)).toBe('5 m 08 s');
    expect(formatDuration(45 * 1000, t)).toBe('0 m 45 s');
  });

  it('renders zero, null, undefined and negatives as the em dash placeholder', () => {
    expect(formatDuration(0, t)).toBe('—');
    expect(formatDuration(null, t)).toBe('—');
    expect(formatDuration(undefined, t)).toBe('—');
    expect(formatDuration(-1000, t)).toBe('—');
  });

  it('never emits all three units on one string (fits one line)', () => {
    const out = formatDuration((1 * 3600 + 12 * 60 + 30) * 1000, t);
    expect(out).toBe('1 h 12 m');
    expect(out).not.toContain('s');
  });
});
