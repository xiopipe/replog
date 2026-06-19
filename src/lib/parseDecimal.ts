/**
 * parseDecimalFloat — parse a free-text decimal that may use a comma separator.
 *
 * Spanish-locale Android keyboards produce "2,5" for 2.5. `parseFloat('2,5')`
 * truncates at the comma and returns 2, silently dropping the decimal part.
 * Normalize the comma to a period first so both "2,5" and "2.5" parse to 2.5.
 *
 * Returns NaN for non-numeric input (same contract as parseFloat), so existing
 * `isNaN(...)` guards at call sites keep working unchanged.
 */
export function parseDecimalFloat(input: string): number {
  return parseFloat(input.replace(',', '.'));
}
