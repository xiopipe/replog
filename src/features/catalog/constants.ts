/**
 * Shared constants for the catalog feature.
 */
import type { MuscleEnum } from '@/db';

/** Ordered list of all supported muscle groups. Used in filter chips and multi-selects. */
export const MUSCLE_KEYS: MuscleEnum[] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'quads',
  'hamstrings_glutes',
  'calves',
  'core',
];
