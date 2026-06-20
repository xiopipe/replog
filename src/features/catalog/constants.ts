/**
 * Shared constants for the catalog feature.
 */
import type { EquipmentEnum, MuscleEnum } from '@/db';

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

/** Ordered list of equipment categories. Used in the catalog equipment filter. */
export const EQUIPMENT_KEYS: EquipmentEnum[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'other',
];
