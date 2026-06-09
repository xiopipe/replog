/**
 * SessionTimer — displays an elapsed time in mm:ss format.
 *
 * Computes elapsed seconds from `startedAt` ISO string using a 1-second
 * setInterval. Cleans up on unmount.
 *
 * Props:
 *   startedAt     — ISO timestamp when timing began (null = not yet started, shows 00:00)
 *   style         — optional text style override
 *   accessibilityLabel — describes the timer for screen readers
 */

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';

import { colors, typography } from '@/lib/theme';

export interface SessionTimerProps {
  startedAt: string | null;
  style?: TextStyle;
  accessibilityLabel?: string;
}

function elapsedSeconds(startedAt: string | null): number {
  if (!startedAt) return 0;
  const diff = Date.now() - new Date(startedAt).getTime();
  return Math.max(0, Math.floor(diff / 1000));
}

export function formatMmSs(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function SessionTimer({ startedAt, style, accessibilityLabel }: SessionTimerProps) {
  const [seconds, setSeconds] = useState(() => elapsedSeconds(startedAt));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a stable ref so the interval callback can always read the latest startedAt
  const startedAtRef = useRef(startedAt);

  useEffect(() => {
    startedAtRef.current = startedAt;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (startedAt) {
      // Tick immediately on first render of the new startedAt, then every second
      intervalRef.current = setInterval(() => {
        setSeconds(elapsedSeconds(startedAtRef.current));
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt]);

  // Re-sync seconds when startedAt changes (without calling setState inside the effect body)
  const display = formatMmSs(startedAt ? seconds : 0);

  return (
    <Text
      style={[styles.text, style]}
      accessibilityLabel={accessibilityLabel ?? display}
      accessibilityLiveRegion="polite"
    >
      {display}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
