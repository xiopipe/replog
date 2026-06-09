import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';
import type { ExerciseWithMuscles } from './queries';

type Props = {
  exercise: ExerciseWithMuscles;
  onPress: () => void;
};

export function ExerciseRow({ exercise, onPress }: Props) {
  const { t } = useTranslation();

  const primaryMuscles = exercise.muscles
    .filter((m) => m.role === 'primary')
    .map((m) => t(`muscles.${m.muscle}`))
    .join(', ');

  const categoryLabel = t(`equipment.${exercise.category}`);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={exercise.name}
      accessibilityHint={t('catalog.title')}
    >
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {categoryLabel}
          {primaryMuscles ? ` · ${primaryMuscles}` : ''}
        </Text>
      </View>
      <View style={styles.right}>
        {exercise.is_bodyweight && (
          <View style={styles.bwBadge}>
            <Text style={styles.bwBadgeText}>{t('exercise.bodyweight_badge')}</Text>
          </View>
        )}
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.textTertiary}
          style={styles.chevron}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: TOUCH_TARGET,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.75,
  },
  left: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  meta: {
    ...typography.label,
    color: colors.textSecondary,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bwBadge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  bwBadgeText: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 11,
  },
  chevron: {
    marginLeft: spacing.xs,
  },
});
