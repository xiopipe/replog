/**
 * SyncStatusIndicator — global sync icon for the screen header (TKT-0047).
 *
 * Shows a 18dp icon in the top-right of the header:
 *   synced   → cloud-done (green / accent)
 *   pending  → cloud-upload (muted)
 *   syncing  → animated cloud-upload (pulsing)
 *   error    → cloud-offline (error red); tap → brief alert
 *
 * Error state is suppressed when the device is offline (shown via
 * OfflineBanner instead) and for self-healing FK-violation races (KI-001
 * classifies these as warn, not error — they never reach the error observable).
 *
 * Usage: render inside a screen header's right slot.
 */

import { Ionicons } from '@expo/vector-icons';
import { syncState } from '@legendapp/state';
import { use$ } from '@legendapp/state/react';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';
import { useNetworkState } from './useNetworkState';
import { deriveSyncStatus, type SyncStateSnapshot } from './syncStatus';

const ICON_SIZE = 18;

// -----------------------------------------------------------
// Aggregation hook — reads syncState() for all user observables
// -----------------------------------------------------------

function useGlobalSyncStatus(isOffline: boolean) {
  const { db } = useAuth();

  // Read sync state for each collection that has user data.
  // syncState() returns an Observable<ObservableSyncState>; use$ subscribes reactively.
  const wsSyncState = use$(db?.workoutSessions$ ? syncState(db.workoutSessions$) : null);
  const setSyncState = use$(db?.sets$ ? syncState(db.sets$) : null);
  const seSyncState = use$(db?.sessionExercises$ ? syncState(db.sessionExercises$) : null);
  const routinesSyncState = use$(db?.routines$ ? syncState(db.routines$) : null);

  const snapshots: SyncStateSnapshot[] = [
    wsSyncState,
    setSyncState,
    seSyncState,
    routinesSyncState,
  ].filter(Boolean) as SyncStateSnapshot[];

  return deriveSyncStatus(snapshots, isOffline);
}

// -----------------------------------------------------------
// Animated pulse for the syncing state
// -----------------------------------------------------------

function useOpacityPulse(active: boolean) {
  // Store Animated.Value in state so it is stable across renders and never
  // accessed via ref.current during render (which triggers react-hooks/refs lint).
  const [opacity] = useState(() => new Animated.Value(1));
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (active) {
      animRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      animRef.current.start();
    } else {
      animRef.current?.stop();
      opacity.setValue(1);
    }
    return () => {
      animRef.current?.stop();
    };
  }, [active, opacity]);

  return opacity;
}

// -----------------------------------------------------------
// Component
// -----------------------------------------------------------

export function SyncStatusIndicator() {
  const { t } = useTranslation();
  const { isOffline } = useNetworkState();
  const status = useGlobalSyncStatus(isOffline);
  const pulseOpacity = useOpacityPulse(status === 'syncing');

  if (isOffline) {
    // Offline banner handles the offline case; hide this indicator.
    return null;
  }

  const handleErrorTap = () => {
    Alert.alert(
      t('sync.error_title'),
      t('sync.error_body'),
      [{ text: t('common.retry'), style: 'default' }],
    );
  };

  if (status === 'error') {
    return (
      <Pressable
        onPress={handleErrorTap}
        style={styles.container}
        accessibilityRole="button"
        accessibilityLabel={t('sync.error_a11y')}
      >
        <Ionicons name="cloud-offline-outline" size={ICON_SIZE} color={colors.error} />
      </Pressable>
    );
  }

  const iconName =
    status === 'synced' ? 'cloud-done-outline' : 'cloud-upload-outline';
  const iconColor =
    status === 'synced' ? colors.success : colors.textTertiary;

  return (
    <Animated.View style={[styles.container, { opacity: pulseOpacity }]}>
      <Ionicons name={iconName} size={ICON_SIZE} color={iconColor} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
