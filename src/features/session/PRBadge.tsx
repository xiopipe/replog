/**
 * PRBadge — animated micro-celebration shown when a new PR is detected.
 *
 * Renders a toast-style badge with the exercise name, weight, and reps.
 * Auto-dismisses after 3 seconds. Uses a simple opacity fade-in/fade-out
 * via Animated.
 */

import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, typography } from '@/lib/theme';

export interface PRBadgeProps {
  exerciseName: string;
  weight: string;
  reps: number;
  onDismiss: () => void;
}

export function PRBadge({ exerciseName, weight, reps, onDismiss }: PRBadgeProps) {
  const { t } = useTranslation();
  // Animated.Value is created once and stored in state so it's stable across renders
  // and not accessed as a ref property during render.
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]);

    anim.start(() => onDismiss());

    return () => anim.stop();
  }, [opacity, onDismiss]);

  return (
    <Animated.View
      style={[styles.container, { opacity }]}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`${t('session.pr_badge_title')} ${exerciseName} ${weight} × ${reps}`}
    >
      <View style={styles.iconWrapper}>
        <Text style={styles.icon}>🏆</Text>
      </View>
      <View style={styles.textWrapper}>
        <Text style={styles.title}>{t('session.pr_badge_title')}</Text>
        <Text style={styles.desc} numberOfLines={1}>
          {t('session.pr_badge_desc', { exercise: exerciseName, weight, reps })}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 12,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.warningBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 100,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.prIconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
  textWrapper: {
    flex: 1,
  },
  title: {
    ...typography.label,
    fontWeight: '600',
    color: colors.warning,
  },
  desc: {
    ...typography.label,
    color: colors.prText,
  },
});
