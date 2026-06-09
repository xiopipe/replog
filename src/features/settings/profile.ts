/**
 * Settings feature — profile data access and mutations.
 *
 * Thin wrapper around the profiles$ observable. All writes go through
 * Legend-State (local-first); never call Supabase directly from here.
 *
 * Profile auto-creation: the handle_new_user Postgres trigger creates the
 * row on sign-up. If the local observable hasn't synced yet, getProfile
 * returns null — the caller should show a loading guard and then upsert
 * if still missing after sync.
 *
 * Write pattern (same as other feature modules):
 *   (profiles$ as any)[id].set(row)
 */

import type { UserObservables, ProfileRow, UnitEnum, FailureMetricEnum, MuscleEnum, ExperienceEnum } from '@/db';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface UpdateProfileInput {
  unit_preference?: UnitEnum;
  default_failure_metric?: FailureMetricEnum;
  experience_level?: ExperienceEnum | null;
  available_days_per_week?: number | null;
  preferred_weekdays?: number[] | null;
  equipment?: string[] | null;
  priority_muscles?: MuscleEnum[] | null;
  limitations?: string | null;
  display_name?: string | null;
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/**
 * Get the current user's profile from the snapshot, or null if not yet loaded.
 *
 * profiles$ is keyed by user id (= auth.uid), so we look up by userId directly.
 */
export function getProfile(
  profiles: Record<string, ProfileRow>,
  userId: string,
): ProfileRow | null {
  return profiles[userId] ?? null;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Update (or upsert) a profile row in the local observable.
 *
 * If the profile row already exists locally, it is patched.
 * If it doesn't exist yet (e.g. sync hasn't completed), a minimal row is
 * created so the user's changes are not lost — the sync will reconcile it.
 *
 * Architecture.md: "profiles is 1:1 with auth.users; Profile is auto-created
 * by the handle_new_user trigger."
 */
export function updateProfile(
  db: UserObservables,
  userId: string,
  patch: UpdateProfileInput,
): void {
  const now = new Date().toISOString();

  const profilesSnapshot: Record<string, ProfileRow> =
    (db.profiles$ as any).peek?.() ?? (db.profiles$ as any).get?.() ?? {};

  const existing = profilesSnapshot[userId] ?? null;

  if (existing) {
    // Patch existing row
    (db.profiles$ as any)[userId].set((prev: ProfileRow) => ({
      ...prev,
      ...patch,
      updated_at: now,
    }));
  } else {
    // Upsert a minimal row so changes are captured before the DB row syncs
    const newRow: ProfileRow = {
      id: userId,
      display_name: patch.display_name ?? null,
      unit_preference: patch.unit_preference ?? 'kg',
      default_failure_metric: patch.default_failure_metric ?? 'rir',
      experience_level: patch.experience_level ?? null,
      available_days_per_week: patch.available_days_per_week ?? null,
      preferred_weekdays: patch.preferred_weekdays ?? null,
      equipment: patch.equipment ?? null,
      priority_muscles: patch.priority_muscles ?? null,
      limitations: patch.limitations ?? null,
      created_at: now,
      updated_at: now,
    };
    (db.profiles$ as any)[userId].set(newRow);
  }
}
