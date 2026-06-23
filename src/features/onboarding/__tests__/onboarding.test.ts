/**
 * Unit tests for onboarding pure helpers (TKT-0043, TKT-0044).
 * Node environment — zero React Native / Expo imports.
 */

import { shouldShowOnboarding, shouldShowProfileNudge, FRESH_REGISTRATION_MS } from '../onboarding';
import type { ProfileRow } from '@/db';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const BASE_PROFILE: ProfileRow = {
  id: 'user-1',
  display_name: null,
  unit_preference: 'kg',
  default_failure_metric: 'rir',
  experience_level: null,
  available_days_per_week: null,
  preferred_weekdays: null,
  equipment: null,
  priority_muscles: null,
  limitations: null,
  onboarding_complete: false,
  created_at: new Date(1_000_000).toISOString(),
  updated_at: new Date(1_000_000).toISOString(),
};

const now = 1_000_000 + 30_000; // 30 seconds after creation

// ---------------------------------------------------------------------------
// shouldShowOnboarding
// ---------------------------------------------------------------------------

describe('shouldShowOnboarding', () => {
  it('returns false when profile is null', () => {
    expect(shouldShowOnboarding(null, now)).toBe(false);
  });

  it('returns false when onboarding_complete is true', () => {
    const profile: ProfileRow = { ...BASE_PROFILE, onboarding_complete: true };
    expect(shouldShowOnboarding(profile, now)).toBe(false);
  });

  it('returns true for a fresh registration with onboarding_complete false', () => {
    expect(shouldShowOnboarding(BASE_PROFILE, now)).toBe(true);
  });

  it('returns false when the account is older than FRESH_REGISTRATION_MS', () => {
    const staleNow = 1_000_000 + FRESH_REGISTRATION_MS + 1;
    expect(shouldShowOnboarding(BASE_PROFILE, staleNow)).toBe(false);
  });

  it('returns true exactly at the FRESH_REGISTRATION_MS boundary', () => {
    const boundaryNow = 1_000_000 + FRESH_REGISTRATION_MS;
    expect(shouldShowOnboarding(BASE_PROFILE, boundaryNow)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shouldShowProfileNudge
// ---------------------------------------------------------------------------

describe('shouldShowProfileNudge', () => {
  it('returns false when profile is null', () => {
    expect(shouldShowProfileNudge(null)).toBe(false);
  });

  it('returns true when onboarding_complete is false', () => {
    expect(shouldShowProfileNudge(BASE_PROFILE)).toBe(true);
  });

  it('returns false when onboarding_complete is true', () => {
    const profile: ProfileRow = { ...BASE_PROFILE, onboarding_complete: true };
    expect(shouldShowProfileNudge(profile)).toBe(false);
  });

  it('returns true even for old profiles where onboarding was skipped', () => {
    const oldProfile: ProfileRow = {
      ...BASE_PROFILE,
      created_at: new Date(0).toISOString(), // epoch
      onboarding_complete: false,
    };
    expect(shouldShowProfileNudge(oldProfile)).toBe(true);
  });
});
