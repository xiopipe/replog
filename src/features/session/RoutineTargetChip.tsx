/**
 * RoutineTargetChip — TKT-0017
 *
 * Read-only reference chip that shows the routine target for the current
 * exercise ("Objetivo: 3×8 @2 RIR"). Shows a checkmark when the user has
 * logged at least target_sets working sets.
 *
 * Rendered near the exercise header; hidden for unplanned sessions.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/lib/theme';
import type { RoutineExerciseRow, SetRow } from '@/db';
import { isTargetMet, countWorkingSets } from './setRowHelpers';

interface RoutineTargetChipProps {
  routineExercise: RoutineExerciseRow;
  currentSets: SetRow[];
}

export function RoutineTargetChip({ routineExercise, currentSets }: RoutineTargetChipProps) {
  const { t } = useTranslation();

  const { target_sets, target_reps_min, target_reps_max, target_rir } = routineExercise;

  // If no target defined at all, render nothing
  if (!target_sets && !target_reps_min && !target_reps_max) return null;

  const workingCount = countWorkingSets(currentSets);
  const met = isTargetMet(workingCount, target_sets ?? null);

  // Build display string: "3×8", "3×6-8", "3×8 @2 RIR"
  let repsStr = '';
  if (target_reps_min != null && target_reps_max != null && target_reps_min !== target_reps_max) {
    repsStr = `${target_reps_min}–${target_reps_max}`;
  } else if (target_reps_max != null) {
    repsStr = String(target_reps_max);
  } else if (target_reps_min != null) {
    repsStr = String(target_reps_min);
  }

  let label = '';
  if (target_sets && repsStr) {
    label = `${target_sets}×${repsStr}`;
  } else if (target_sets) {
    label = `${target_sets} ${t('session.target_sets_unit')}`;
  } else if (repsStr) {
    label = repsStr;
  }

  if (target_rir != null) {
    label += ` @${target_rir} RIR`;
  }

  return (
    <View style={[styles.chip, met && styles.chipMet]}>
      {met ? (
        <Ionicons name="checkmark-circle" size={13} color={colors.success} />
      ) : null}
      <Text style={[styles.label, met && styles.labelMet]} accessibilityLabel={t('session.target_a11y', { label })}>
        {t('session.target_prefix')} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipMet: {
    borderColor: colors.success,
    backgroundColor: colors.surfaceAlt,
  },
  label: {
    ...typography.label,
    fontSize: 11,
    color: colors.textTertiary,
  },
  labelMet: {
    color: colors.success,
    fontWeight: '600',
  },
});
