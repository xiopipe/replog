import type { SetRow as SetRowData, UnitEnum } from '@/db';
import { kgToLb } from '@/lib/hypertrophy';

/**
 * Format a set's weight for display, honoring the user's unit preference.
 *
 * Prefers the stored weight_value/weight_unit (what the user actually typed).
 * Falls back to the canonical weight_kg converted into the user's unit — never
 * a hardcoded "kg" label (TKT-0005). Returns "—" when there is no weight.
 */
export function formatWeight(
  set: Pick<SetRowData, 'weight_value' | 'weight_unit' | 'weight_kg'>,
  userUnit: UnitEnum,
): string {
  if (set.weight_value != null) return `${set.weight_value} ${set.weight_unit ?? userUnit}`;
  if (set.weight_kg == null) return '—';
  const value = userUnit === 'lb' ? kgToLb(set.weight_kg) : set.weight_kg;
  return `${Math.round(value * 100) / 100} ${userUnit}`;
}
