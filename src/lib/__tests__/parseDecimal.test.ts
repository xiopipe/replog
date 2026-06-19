/**
 * Unit tests for src/lib/parseDecimal.ts (parseDecimalFloat).
 *
 * Acceptance: TKT-0025 — comma-decimal weight input ("2,5" -> 2.5).
 */

import { parseDecimalFloat } from '../parseDecimal';

describe('parseDecimalFloat', () => {
  it('parses a comma decimal separator as a period', () => {
    expect(parseDecimalFloat('2,5')).toBe(2.5);
    expect(parseDecimalFloat('100,25')).toBe(100.25);
  });

  it('still parses a period decimal separator (unchanged behavior)', () => {
    expect(parseDecimalFloat('2.5')).toBe(2.5);
    expect(parseDecimalFloat('42')).toBe(42);
  });

  it('returns NaN for non-numeric input so isNaN guards keep working', () => {
    expect(parseDecimalFloat('abc')).toBeNaN();
    expect(parseDecimalFloat('')).toBeNaN();
  });
});
