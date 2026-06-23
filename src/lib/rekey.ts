/**
 * Re-key helper — pure, node-testable logic.
 *
 * When a local-UUID user adopts a cloud account (anonymous or permanent), all
 * local rows whose `user_id` equals the local UUID must be re-keyed to the
 * Supabase uid BEFORE the first sync push. This module contains:
 *
 *   1. `rekeyRows` — transforms an array of rows (any type with a `user_id`
 *      field) from oldUid → newUid. Pure function; no I/O.
 *
 *   2. `TABLE_REKEY_ORDER` — the dependency-safe write order. Parents must be
 *      re-keyed before children to avoid transient FK issues when Legend-State
 *      flushes the dirty writes to Supabase.
 *
 * The actual observable writes stay in `src/lib/auth.tsx` (`adoptLocalData`),
 * which imports these helpers but is not imported here.
 *
 * Background on why only `user_id` needs updating
 * ------------------------------------------------
 * All child tables carry a denormalized `user_id` (for RLS) AND an FK to the
 * parent row (e.g. `sets.session_exercise_id`). The parent FK references the
 * row's PRIMARY KEY (`id`), which is a client-generated UUID that does NOT
 * change during re-keying. Only `user_id` (the owner field) changes. So a
 * simple `user_id` field update across all tables is sufficient — no cascading
 * PK changes are needed.
 *
 * Profiles special case
 * ---------------------
 * The `profiles` table uses `id = auth.uid()` as its PK (not a separate uuid).
 * A local-only user who has never adopted a Supabase account will NOT have a
 * profiles row in the Supabase `profiles` table (the `handle_new_user` trigger
 * only fires on `auth.users` INSERT, which never happens for local-only users).
 * However, a local profiles row may exist in the SQLite cache under `localUid`.
 * That row cannot be re-keyed by updating `user_id` alone — it also needs its
 * PK (`id`) changed to `supabaseUid`. The `rekeyProfileRows` helper handles
 * this. Since the `handle_new_user` trigger fires on anonymous sign-in, a fresh
 * profiles row is created in Supabase automatically. The local profiles row
 * under `localUid` should be discarded (or overwritten by the Supabase fetch)
 * rather than pushed — see `adoptLocalData` for the handling.
 */

/**
 * Transform an array of user-scoped rows, replacing every `user_id` that equals
 * `oldUid` with `newUid`. Returns a NEW array of new objects — pure/immutable.
 *
 * @param rows    - Rows from one observable collection (e.g. `Object.values(sessions$.get())`).
 * @param oldUid  - The local UUID to replace.
 * @param newUid  - The Supabase uid to write.
 * @returns       - Transformed rows with updated `user_id` and `updated_at`.
 */
export function rekeyRows<T extends { user_id: string; updated_at?: string }>(
  rows: T[],
  oldUid: string,
  newUid: string,
): T[] {
  const now = new Date().toISOString();
  return rows
    .filter((row) => row.user_id === oldUid)
    .map((row) => ({
      ...row,
      user_id: newUid,
      ...(row.updated_at !== undefined ? { updated_at: now } : {}),
    }));
}

/**
 * Special case: profiles rows use `id` as PK (= auth.uid). During re-keying,
 * the local profile row (id = localUid) cannot simply have its `id` changed —
 * there is no `user_id` column to update separately. The re-key strategy for
 * profiles is therefore: discard the local profile row (let the Supabase
 * `handle_new_user` trigger create a fresh profiles row for the Supabase uid,
 * which will be fetched on the next sync). The local preferences in the profile
 * (unit, failure_metric, etc.) are lost unless explicitly re-applied — this is
 * an accepted trade-off for the MVP: the local profile preferences are minimal
 * (typically not even set during a very short local-only session).
 *
 * This function returns the local profile row's preference data so callers can
 * optionally re-apply it to the new Supabase-uid profile after adoption.
 *
 * @param rows    - Rows from the profiles observable.
 * @param localUid - The local UUID.
 * @returns        - The matching profile row if found, or null.
 */
export function extractLocalProfile<T extends { id: string }>(
  rows: T[],
  localUid: string,
): T | null {
  return rows.find((r) => r.id === localUid) ?? null;
}

/**
 * Dependency-safe write order for re-keying.
 *
 * Supabase FK constraints (at Postgres level) are not checked during local
 * observable writes — FK enforcement only matters when rows reach Postgres.
 * However, Legend-State pushes each collection independently on its own
 * debounce timer, so parents may not have landed in Postgres when child rows
 * arrive. The sync layer already handles this via `retrySync: true` with
 * exponential backoff (KI-001 / src/db/sync.ts). Writing in parent-first order
 * does not eliminate the race but reduces it.
 *
 * Order rationale:
 *   profiles        — standalone (PK = uid); handled separately (see above)
 *   routines        — no parent user table
 *   routine_exercises — child of routines
 *   plans           — no parent user table
 *   plan_days       — child of plans + routines
 *   workout_sessions — no parent user table
 *   session_exercises — child of workout_sessions
 *   sets            — child of session_exercises
 *   user_exercises  — no parent user table (user custom exercises)
 *   user_exercise_muscles — child of user_exercises
 *   exercise_favorites — no parent user table
 */
export const TABLE_REKEY_ORDER = [
  'routines',
  'routine_exercises',
  'plans',
  'plan_days',
  'workout_sessions',
  'session_exercises',
  'sets',
  'user_exercises',
  'user_exercise_muscles',
  'exercise_favorites',
] as const;

export type RekeyableTable = (typeof TABLE_REKEY_ORDER)[number];

/**
 * Determine the auth state variant used by the Settings screen and other
 * UI that needs to gate CTAs.
 *
 * Returns one of:
 *   'local-only'  — no Supabase session; user has only a local UUID.
 *   'anonymous'   — Supabase session exists and user.app_metadata.is_anonymous === true.
 *   'permanent'   — Supabase session exists and user is NOT anonymous (linked/registered).
 */
export type AuthVariant = 'local-only' | 'anonymous' | 'permanent';

export function getAuthVariant(
  hasCloudSession: boolean,
  isAnonymousUser: boolean,
): AuthVariant {
  if (!hasCloudSession) return 'local-only';
  if (isAnonymousUser) return 'anonymous';
  return 'permanent';
}

/**
 * Determine which Settings account section elements should be visible.
 *
 * @returns An object with booleans for each conditional element.
 */
export interface SettingsAccountState {
  /** Show "Crear cuenta" / "Iniciar sesión" CTA (criteria 10, 11). */
  showCloudAdoptionCta: boolean;
  /** Show the "Cerrar sesión" button (criteria 11, 13, 14). */
  showSignOut: boolean;
  /** When signing out, show the anonymous-data-warning dialog (criterion 13). */
  requireSignOutConfirmation: boolean;
}

export function getSettingsAccountState(variant: AuthVariant): SettingsAccountState {
  switch (variant) {
    case 'local-only':
      return {
        showCloudAdoptionCta: true,
        showSignOut: false,            // nothing to sign out of
        requireSignOutConfirmation: false,
      };
    case 'anonymous':
      return {
        showCloudAdoptionCta: true,   // encourage upgrade
        showSignOut: true,
        requireSignOutConfirmation: true, // data-loss warning
      };
    case 'permanent':
      return {
        showCloudAdoptionCta: false,
        showSignOut: true,
        requireSignOutConfirmation: false, // plain sign-out
      };
  }
}
