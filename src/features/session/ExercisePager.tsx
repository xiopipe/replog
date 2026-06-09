/**
 * ExercisePager — position dots for exercise navigation.
 *
 * Displays a row of dots: the current exercise is a wider pill (accent color),
 * others are grey circles. Matches the wireframe: active-session.svg.
 * Tapping a dot allows jumping to that exercise.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing, TOUCH_TARGET } from '@/lib/theme';

export interface ExercisePagerProps {
  total: number;
  currentIndex: number;
  onSelect?: (index: number) => void;
}

export function ExercisePager({ total, currentIndex, onSelect }: ExercisePagerProps) {
  const { t } = useTranslation();

  if (total <= 1) return null;

  return (
    <View style={styles.container} accessibilityRole="tablist">
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === currentIndex;
        return (
          <Pressable
            key={i}
            onPress={() => onSelect?.(i)}
            style={styles.dotWrapper}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t('session.exercise_progress', { current: i + 1, total })}
            hitSlop={8}
          >
            <View style={[styles.dot, isActive ? styles.dotActive : styles.dotInactive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: TOUCH_TARGET,
  },
  dotWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  dot: {
    height: 7,
    borderRadius: 3.5,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.accent,
  },
  dotInactive: {
    width: 7,
    backgroundColor: colors.textTertiary,
  },
});
