// Polyfills must load before any other code (uuid + Supabase need these).
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth';
import '@/lib/i18n';
import { colors } from '@/lib/theme';
import { OfflineBanner } from '@/features/sync/OfflineBanner';
import { OnboardingModal } from '@/features/onboarding/OnboardingModal';
import { shouldShowOnboarding } from '@/features/onboarding/onboarding';
import { getProfile, updateProfile } from '@/features/settings/profile';
import { useRows } from '@/db';
import type { FailureMetricEnum, UnitEnum } from '@/db';
import { useNotificationSetup } from '@/features/notifications/useNotificationSetup';

// ---------------------------------------------------------------------------
// OnboardingGate — mounted with key=userId so it auto-resets on user change.
// Keeps its dismissed state local; when the user signs out and back in,
// the key changes → component remounts → dismissed resets to false.
// ---------------------------------------------------------------------------

interface OnboardingGateProps {
  userId: string;
}

function OnboardingGate({ userId }: OnboardingGateProps) {
  const { db } = useAuth();

  // Session-scoped dismiss — resets to false automatically on remount (new key).
  const [dismissed, setDismissed] = useState(false);

  const rawProfiles = useRows(db?.profiles$);

  const profile = useMemo(
    () => (rawProfiles ? getProfile(rawProfiles, userId) : null),
    [rawProfiles, userId],
  );

  // Derived: show the modal when conditions are met (no useEffect needed).
  const showOnboarding = !dismissed && shouldShowOnboarding(profile);

  const handleOnboardingConfirm = useCallback(
    (unit: UnitEnum, metric: FailureMetricEnum) => {
      if (!db) return;
      updateProfile(db, userId, {
        unit_preference: unit,
        default_failure_metric: metric,
        onboarding_complete: true,
      });
      setDismissed(true);
    },
    [db, userId],
  );

  // Skip: don't persist. Settings nudge will appear.
  const handleOnboardingSkip = useCallback(() => {
    setDismissed(true);
  }, []);

  return (
    <OnboardingModal
      visible={showOnboarding}
      onConfirm={handleOnboardingConfirm}
      onSkip={handleOnboardingSkip}
    />
  );
}

// ---------------------------------------------------------------------------
// RootNavigator
// ---------------------------------------------------------------------------

function RootNavigator() {
  const { initializing, cloudUid } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // TKT-0062/0063/0064: set up Android channel, foreground handler, and
  // reactive reminder/inactivity scheduling. Only active when db is available.
  useNotificationSetup();

  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';

    // TKT-0067: The app is always accessible with a local uid — no forced redirect
    // to login on first launch. Only redirect to login when the user is ALREADY in
    // the auth group with a cloud session (they've signed in) or when explicitly
    // navigating away from the auth group after signing in.
    //
    // We never redirect unauthenticated users to login — they use the local uid.
    if (cloudUid && inAuthGroup) {
      // User signed in — take them to the app.
      router.replace('/(tabs)');
    }
    // Note: no redirect for !cloudUid — local-only users stay in the app.
  }, [cloudUid, initializing, segments, router]);

  if (initializing) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.navigatorWrapper}>
      {/* TKT-0048: Global offline banner — shown below status bar on all screens */}
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="catalog/index" />
        <Stack.Screen name="catalog/[id]" />
        <Stack.Screen name="catalog/create" />
        <Stack.Screen name="routines/index" />
        <Stack.Screen name="routines/editor" />
        <Stack.Screen name="plan/index" />
        <Stack.Screen name="plan/templates" />
        {/* Session routes — tab bar intentionally hidden (not inside (tabs)) */}
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="session/summary/[id]" />
        <Stack.Screen name="session/retroactive" />
        {/* History detail route */}
        <Stack.Screen name="history/[id]" />
        {/* Notification settings (TKT-0062) */}
        <Stack.Screen name="settings/notifications" />
      </Stack>

      {/*
       * TKT-0043: Post-register onboarding modal (overlay, not a route).
       * The `key` prop equals the active user id so the gate remounts
       * automatically when the user signs out and a different user signs in —
       * resetting its session-scoped `dismissed` state without any useEffect
       * setState.
       *
       * TKT-0067: Only show onboarding for cloud users (anonymous or permanent)
       * who have a real Supabase profile row. Local-only users skip it.
       */}
      {cloudUid ? (
        <OnboardingGate key={cloudUid} userId={cloudUid} />
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  navigatorWrapper: {
    flex: 1,
  },
});
