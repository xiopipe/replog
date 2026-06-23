/**
 * Onboarding helpers — pure logic, no React or RN imports.
 *
 * TKT-0043: Detect whether the post-register onboarding prompt should be shown
 * and compute the derived onboarding state.
 *
 * Detection strategy: use the `onboarding_complete` boolean column added in
 * migration 20260622200001_add_onboarding_complete.sql. When the column is
 * FALSE (default for all new rows) AND the user just registered (created_at
 * within the last 90 seconds), show the prompt. The 90-second window is larger
 * than the 60-second one mentioned in the ticket to account for email-confirm
 * round-trips and slow connections. `onboarding_complete` persists across
 * sessions so the prompt never re-appears after the user has seen it.
 *
 * For TKT-0044 (Settings nudge): the nudge is shown when `onboarding_complete`
 * is still false regardless of how old the account is. This lets users who
 * skipped onboarding see it again in Settings.
 */

import type { ProfileRow } from '@/db';

/** Maximum age in milliseconds for a registration to be considered "fresh". */
export const FRESH_REGISTRATION_MS = 90_000;

/**
 * Determine whether the one-time onboarding prompt should be shown.
 *
 * @param profile   - The user's current profile row (or null if not loaded yet).
 * @param now       - Current timestamp in ms (injectable for testing).
 * @returns true when the prompt must be shown; false otherwise.
 */
export function shouldShowOnboarding(
  profile: ProfileRow | null,
  now: number = Date.now(),
): boolean {
  if (!profile) return false;
  if (profile.onboarding_complete) return false;

  const createdMs = new Date(profile.created_at).getTime();
  const ageMs = now - createdMs;
  return ageMs <= FRESH_REGISTRATION_MS;
}

/**
 * Determine whether the Settings profile-completion nudge should be shown.
 *
 * The nudge appears when `onboarding_complete` is false — meaning either the
 * user has never seen the onboarding prompt or tapped "Skip" without saving.
 * It is hidden once the user confirms their choices (onboarding_complete = true).
 *
 * @param profile - The user's current profile row (or null if not loaded yet).
 * @returns true when the nudge card should be visible in Settings.
 */
export function shouldShowProfileNudge(profile: ProfileRow | null): boolean {
  if (!profile) return false;
  return !profile.onboarding_complete;
}
