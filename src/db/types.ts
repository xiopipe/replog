/**
 * Row type definitions mirroring supabase/migrations/20260607160203_init_schema.sql exactly.
 * These are plain data shapes — no business logic.
 *
 * Conventions (from Architecture.md):
 *   - uuid PKs generated client-side
 *   - created_at / updated_at on every row (UTC)
 *   - deleted_at for soft-delete (nullable)
 *   - user_id denormalized on child tables for RLS + per-user sync
 *   - Weight: dual storage (weight_value + weight_unit typed + weight_kg normalized)
 */

// ===================== ENUMS =====================

export type UnitEnum = 'kg' | 'lb';
export type FailureMetricEnum = 'rir' | 'rpe' | 'none';
export type ExperienceEnum = 'beginner' | 'intermediate' | 'advanced';
export type EquipmentEnum = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'other';
export type MuscleEnum =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'quads'
  | 'hamstrings_glutes'
  | 'calves'
  | 'core';
export type MuscleRoleEnum = 'primary' | 'secondary';
export type SessionStatusEnum = 'in_progress' | 'completed';

// ===================== PROFILES =====================

/**
 * TKT-0062: Notification preferences shape stored as JSONB in profiles.notification_prefs.
 * All sub-fields are optional for forward-compatibility; defaults are applied by the app.
 */
export interface NotificationPrefs {
  /** Master switch — all notification types off when false. Default: false. */
  enabled?: boolean;
  workoutReminders?: {
    /** Whether workout reminder notifications are scheduled. Default: true. */
    enabled?: boolean;
    /** Local time string "HH:mm" (24h). Default: "18:00". */
    time?: string;
  };
  inactivity?: {
    /** Whether the inactivity re-engagement notification is scheduled. Default: true. */
    enabled?: boolean;
  };
  prCelebration?: {
    /** Whether PR celebration notifications fire. Default: true. */
    enabled?: boolean;
  };
}

export interface ProfileRow {
  id: string; // = auth.uid()
  display_name: string | null;
  unit_preference: UnitEnum;
  default_failure_metric: FailureMetricEnum;
  experience_level: ExperienceEnum | null;
  available_days_per_week: number | null;
  preferred_weekdays: number[] | null;
  equipment: string[] | null;
  priority_muscles: MuscleEnum[] | null;
  limitations: string | null;
  /** TKT-0043: true once the user has completed or dismissed the post-register onboarding prompt. */
  onboarding_complete: boolean;
  /** TKT-0062: notification preferences (JSONB, additive migration). Empty object = all defaults. */
  notification_prefs?: NotificationPrefs | null;
  created_at: string;
  updated_at: string;
  // profiles has no deleted_at in the schema
}

// ===================== EXERCISES =====================

export interface ExerciseRow {
  id: string;
  user_id: string | null; // null = global predefined
  name: string;
  category: EquipmentEnum;
  is_custom: boolean;
  is_bodyweight: boolean;
  instructions: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ===================== EXERCISE_MUSCLES =====================

export interface ExerciseMuscleRow {
  id: string;
  exercise_id: string;
  muscle: MuscleEnum;
  role: MuscleRoleEnum;
  contribution: number; // 1.0 primary, 0.5 secondary
  created_at: string;
  updated_at: string;
  // exercise_muscles has no deleted_at in the schema
}

// ===================== ROUTINES =====================

export interface RoutineRow {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ===================== ROUTINE_EXERCISES =====================

export interface RoutineExerciseRow {
  id: string;
  user_id: string;
  routine_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_weight_kg: number | null;
  target_rir: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ===================== PLANS =====================

export interface PlanRow {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ===================== PLAN_DAYS =====================

export interface PlanDayRow {
  id: string;
  user_id: string;
  plan_id: string;
  routine_id: string;
  order_index: number;
  weekday: number | null; // 0–6 (0=Monday); null = flexible
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ===================== WORKOUT_SESSIONS =====================

export interface WorkoutSessionRow {
  id: string;
  user_id: string;
  routine_id: string | null;
  name: string | null;
  started_at: string;
  ended_at: string | null;
  /**
   * Real active workout time in seconds, excluding backgrounded intervals
   * (TKT-0011). Source of truth for session duration. Defaults to 0 on legacy
   * rows; consumers fall back to ended_at - started_at when this is 0.
   */
  accumulated_active_seconds: number;
  status: SessionStatusEnum;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ===================== SESSION_EXERCISES =====================

export interface SessionExerciseRow {
  id: string;
  user_id: string;
  session_id: string;
  exercise_id: string;
  order_index: number;
  started_at: string | null;
  ended_at: string | null;
  superset_group: string | null;
  superset_order: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ===================== EXERCISE_FAVORITES =====================

export interface ExerciseFavoriteRow {
  id: string;
  user_id: string;
  exercise_id: string;
  created_at: string;
}

// ===================== SETS =====================

export interface SetRow {
  id: string;
  user_id: string;
  session_exercise_id: string;
  set_index: number;
  // Weight: dual storage — display weight_value+weight_unit, compute with weight_kg
  weight_value: number | null;
  weight_unit: UnitEnum | null;
  weight_kg: number | null;
  reps: number | null;
  failure_metric: FailureMetricEnum;
  rir: number | null;
  rpe: number | null;
  is_warmup: boolean;
  reached_failure: boolean;
  rest_seconds: number | null;
  drop_group: string | null;
  drop_order: number | null;
  performed_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
