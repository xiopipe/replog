/**
 * PRBadge — animated micro-celebration shown when a new PR is detected.
 *
 * Renders a toast-style badge with the exercise name, weight, and reps.
 * Auto-dismisses after 3 seconds. Uses a simple opacity fade-in/fade-out
 * via Animated.
 *
 * TKT-0027: now accepts prType ('1rm' | 'rep' | null) and delta (e1RM
 * improvement in the user's unit) so the label is specific.
 */

import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '@/lib/theme';
import type { UnitEnum } from '@/db';

export type PRType = '1rm' | 'rep';

export interface PRBadgeProps {
  exerciseName: string;
  weight: string;
  reps: number;
  onDismiss: () => void;
  /** Which PR type fired. 'both' and '1rm' show the 1RM label (spec: prefer 1RM). */
  prType?: PRType | null;
  /** Improvement delta in the user's display unit (e1RM_new − e1RM_prev). */
  delta?: number | null;
  userUnit?: UnitEnum;
}

export function PRBadge({
  exerciseName,
  weight,
  reps,
  onDismiss,
  prType,
  delta,
  userUnit = 'kg',
}: PRBadgeProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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

  // Determine the title label based on PR type.
  // If both fired, prefer 1RM (spec TKT-0027).
  const titleKey =
    prType === '1rm'
      ? 'session.pr_badge_title_1rm'
      : prType === 'rep'
        ? 'session.pr_badge_title_rep'
        : 'session.pr_badge_title';

  const titleLabel = t(titleKey);

  // Delta sub-label shown only for 1RM PR when delta is meaningful
  const showDelta = prType === '1rm' && delta != null && delta > 0;
  const deltaLabel = showDelta
    ? t('session.pr_badge_delta', {
        delta: delta!.toFixed(1),
        unit: userUnit,
      })
    : null;

  // TKT-0009 #9: compose the whole label (incl. "×" and word order) through t()
  // so it is translatable, instead of concatenating a hardcoded string.
  const a11yLabel =
    t('session.pr_badge_a11y', { title: titleLabel, exercise: exerciseName, weight, reps }) +
    (deltaLabel ? ` ${deltaLabel}` : '');

  return (
    <Animated.View
      // TKT-0009 #2: offset by the safe-area inset so the badge clears the status bar.
      style={[styles.container, { opacity, top: insets.top + spacing.xs }]}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={a11yLabel}
    >
      <View style={styles.iconWrapper}>
        <Text style={styles.icon}>🏆</Text>
      </View>
      <View style={styles.textWrapper}>
        <Text style={styles.title}>{titleLabel}</Text>
        {deltaLabel ? (
          <Text style={styles.delta} numberOfLines={1}>
            {deltaLabel}
          </Text>
        ) : null}
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
    // `top` is applied inline from the safe-area inset (TKT-0009 #2).
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
  delta: {
    ...typography.label,
    fontWeight: '500',
    color: colors.warning,
    opacity: 0.8,
  },
  desc: {
    ...typography.label,
    color: colors.prText,
  },
});
