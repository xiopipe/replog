/**
 * User observables factory.
 *
 * Call `createUserObservables(uid)` exactly once from the app root
 * after the Supabase auth session is confirmed (i.e. after sign-in or
 * on startup when a cached session is restored). Store the returned
 * object somewhere accessible (React context, global module singleton, etc.)
 * and pass it down to screens.
 *
 * Example (app root, after session is confirmed):
 *
 *   import { supabase } from '@/lib/supabase';
 *   import { createUserObservables } from '@/db/user-observables';
 *
 *   supabase.auth.onAuthStateChange((event, session) => {
 *     if (session?.user) {
 *       const db = createUserObservables(session.user.id);
 *       // store db in context or module-level singleton
 *     }
 *   });
 *
 * Global read-only observables (exercises catalog, exercise_muscles catalog)
 * are created once outside the user scope — they do not depend on a uid.
 * They are exported directly from this module for convenience.
 */

import { observe } from '@legendapp/state';
import { createProfilesObservable } from './profiles';
import {
  createGlobalExercisesObservable,
  createUserExercisesObservable,
} from './exercises';
import {
  createGlobalExerciseMusclesObservable,
  createUserExerciseMusclesObservable,
} from './exercise_muscles';
import { createRoutinesObservable } from './routines';
import { createRoutineExercisesObservable } from './routine_exercises';
import { createPlansObservable } from './plans';
import { createPlanDaysObservable } from './plan_days';
import { createWorkoutSessionsObservable } from './workout_sessions';
import { createSessionExercisesObservable } from './session_exercises';
import { createSetsObservable } from './sets';

// ---------------------------------------------------------------------------
// Global (read-only) catalog observables — created once, uid-independent
// ---------------------------------------------------------------------------

/**
 * Predefined exercise catalog (user_id IS NULL rows). Read-only.
 * Created at module load time — safe because it requires no uid.
 */
export const globalExercises$ = createGlobalExercisesObservable();

/**
 * Muscle mappings for the global exercise catalog. Read-only.
 */
export const globalExerciseMuscles$ = createGlobalExerciseMusclesObservable();

// ---------------------------------------------------------------------------
// Per-user observable bundle
// ---------------------------------------------------------------------------

export interface UserObservables {
  /** Current user's profile (keyed by uid). */
  profiles$: ReturnType<typeof createProfilesObservable>;
  /** Current user's custom exercises (excludes deleted). */
  userExercises$: ReturnType<typeof createUserExercisesObservable>;
  /** Muscle mappings for the user's custom exercises. */
  userExerciseMuscles$: ReturnType<typeof createUserExerciseMusclesObservable>;
  /** User's routines (excludes deleted). */
  routines$: ReturnType<typeof createRoutinesObservable>;
  /** Exercises within each routine (excludes deleted). */
  routineExercises$: ReturnType<typeof createRoutineExercisesObservable>;
  /** User's training plans (excludes deleted). */
  plans$: ReturnType<typeof createPlansObservable>;
  /** Days within each plan (excludes deleted). */
  planDays$: ReturnType<typeof createPlanDaysObservable>;
  /** Workout sessions (excludes deleted). */
  workoutSessions$: ReturnType<typeof createWorkoutSessionsObservable>;
  /** Exercises performed in each session (excludes deleted). */
  sessionExercises$: ReturnType<typeof createSessionExercisesObservable>;
  /** Per-set records (excludes deleted). */
  sets$: ReturnType<typeof createSetsObservable>;
}

/**
 * Factory: creates all per-user synced observables bound to the given uid.
 *
 * @param uid - The authenticated user's Supabase uuid (session.user.id).
 * @returns   - A bundle of observables for all user-data entities.
 */
export function createUserObservables(uid: string): UserObservables {
  const db: UserObservables = {
    profiles$: createProfilesObservable(uid),
    userExercises$: createUserExercisesObservable(uid),
    userExerciseMuscles$: createUserExerciseMusclesObservable(uid),
    routines$: createRoutinesObservable(uid),
    routineExercises$: createRoutineExercisesObservable(uid),
    plans$: createPlansObservable(uid),
    planDays$: createPlanDaysObservable(uid),
    workoutSessions$: createWorkoutSessionsObservable(uid),
    sessionExercises$: createSessionExercisesObservable(uid),
    sets$: createSetsObservable(uid),
  };

  // Synced observables are lazy: they only start syncing once observed. A
  // workout logged while offline must back up to Supabase as soon as
  // connectivity returns — even if the user never reopens that screen. This
  // app-lifetime observer touches every collection so all of them activate
  // their sync (initial fetch + realtime + offline retry queue) at login,
  // independent of navigation. The body is a no-op read, so re-runs are cheap.
  observe(() => {
    db.profiles$.get();
    db.userExercises$.get();
    db.userExerciseMuscles$.get();
    db.routines$.get();
    db.routineExercises$.get();
    db.plans$.get();
    db.planDays$.get();
    db.workoutSessions$.get();
    db.sessionExercises$.get();
    db.sets$.get();
  });

  return db;
}
