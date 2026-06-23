/**
 * Snackbar — TKT-0051 (undo on delete).
 *
 * A brief bottom toast with an optional action button.
 * Auto-dismisses after `durationMs` milliseconds (default 3000).
 * Renders above the safe-area bottom inset.
 *
 * Usage:
 *   <Snackbar
 *     visible={!!deletedId}
 *     message={t('routines.undo_delete')}
 *     actionLabel={t('routines.undo_action')}
 *     onAction={handleUndo}
 *     onDismiss={() => setDeletedId(null)}
 *   />
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '@/lib/theme';

interface SnackbarProps {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  /** Duration in ms before auto-dismiss (default 3000). */
  durationMs?: number;
}

export function Snackbar({
  visible,
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 3000,
}: SnackbarProps) {
  const insets = useSafeAreaInsets();
  // Use useState with lazy initializer so Animated.Value is created once and
  // is not accessed via ref.current during render (avoids react-hooks/refs rule).
  const [opacity] = useState(() => new Animated.Value(0));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      // Fade in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Schedule auto-dismiss
      timerRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => onDismiss());
      }, durationMs);
    } else {
      opacity.setValue(0);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: insets.bottom + spacing.lg, opacity },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={() => {
            if (timerRef.current) {
              clearTimeout(timerRef.current);
              timerRef.current = null;
            }
            onAction();
            onDismiss();
          }}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    // Shadow for dark surfaces
    shadowColor: colors.border,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  message: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 14,
  },
  actionBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  actionText: {
    ...typography.label,
    color: colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
});
