/**
 * Public API for the RepLog data layer.
 *
 * Import everything from '@/db' — never import Supabase or Legend-State
 * directly in screen/component files.
 *
 * Typical usage in a screen:
 *
 *   import { useUserObservables } from '@/db';
 *   import { use$ } from '@legendapp/state/react';
 *
 *   const { sets$ } = useUserObservables();
 *   const sets = use$(sets$);
 */

// Types
export type {
  UnitEnum,
  FailureMetricEnum,
  ExperienceEnum,
  EquipmentEnum,
  MuscleEnum,
  MuscleRoleEnum,
  SessionStatusEnum,
  ProfileRow,
  ExerciseRow,
  ExerciseMuscleRow,
  ExerciseFavoriteRow,
  RoutineRow,
  RoutineExerciseRow,
  PlanRow,
  PlanDayRow,
  WorkoutSessionRow,
  SessionExerciseRow,
  SetRow,
} from './types';

// Sync utilities
export { generateId, softDelete, restoreItem, customSynced } from './sync';

// Reactive collection read hook (use instead of raw use$ for collections)
export { useRows } from './use-rows';

// Global (read-only) catalog observables
export { globalExercises$, globalExerciseMuscles$ } from './user-observables';

// Per-user observable factory + types
export {
  createUserObservables,
  type UserObservables,
} from './user-observables';

// Individual observable factories (for advanced use or testing)
export { createProfilesObservable } from './profiles';
export { createGlobalExercisesObservable, createUserExercisesObservable } from './exercises';
export {
  createGlobalExerciseMusclesObservable,
  createUserExerciseMusclesObservable,
} from './exercise_muscles';
export { createRoutinesObservable } from './routines';
export { createRoutineExercisesObservable } from './routine_exercises';
export { createPlansObservable } from './plans';
export { createPlanDaysObservable } from './plan_days';
export { createWorkoutSessionsObservable } from './workout_sessions';
export { createSessionExercisesObservable } from './session_exercises';
export { createSetsObservable } from './sets';
export { createExerciseFavoritesObservable } from './exercise_favorites';
