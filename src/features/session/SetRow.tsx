/**
 * SetRow — inline editable set row for the active-session screen.
 *
 * Layout (per wireframe): # | Peso | Reps | RIR/RPE | ✓
 *
 * - Numeric keypad inputs with +/- steppers.
 * - Weight displays as typed (weight_value + weight_unit).
 * - For is_bodyweight exercises the weight column is labelled "Carga añadida" (0 allowed).
 * - Failure metric (RIR / RPE / none) follows profile default, can be changed per set.
 * - is_warmup toggle: warmup rows are visually muted.
 * - Dropset visual indicator when drop_group is set.
 */

import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import type { SetRow as SetRowData, FailureMetricEnum, UnitEnum } from '@/db';
import { colors, spacing, typography, radius, TOUCH_TARGET } from '@/lib/theme';

export interface SetRowProps {
  set: SetRowData;
  index: number;
  isBodyweight: boolean;
  defaultFailureMetric: FailureMetricEnum;
  userUnit: UnitEnum;
  isSelected?: boolean;
  onConfirm: (patch: Partial<SetRowData>) => void;
  onDelete?: () => void;
  onSelectionToggle?: () => void;
}

function NumericField({
  value,
  onChangeText,
  onIncrement,
  onDecrement,
  step,
  minValue,
  allowDecimal,
  label,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  step: number;
  minValue: number;
  allowDecimal?: boolean;
  label: string;
}) {
  return (
    <View style={fieldStyles.wrapper}>
      <Pressable
        onPress={onDecrement}
        style={fieldStyles.stepper}
        accessibilityLabel={`${label} menos`}
        hitSlop={4}
      >
        <Ionicons name="remove" size={14} color={colors.textSecondary} />
      </Pressable>
      <TextInput
        style={fieldStyles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
        selectTextOnFocus
        accessibilityLabel={label}
        returnKeyType="done"
      />
      <Pressable
        onPress={onIncrement}
        style={fieldStyles.stepper}
        accessibilityLabel={`${label} más`}
        hitSlop={4}
      >
        <Ionicons name="add" size={14} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  stepper: {
    width: 24,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    ...typography.logNumber,
    color: colors.textPrimary,
    minWidth: 36,
    textAlign: 'center',
    paddingVertical: 6,
  },
});

export function SetRow({
  set,
  index,
  isBodyweight,
  defaultFailureMetric,
  userUnit,
  isSelected,
  onConfirm,
  onDelete,
  onSelectionToggle,
}: SetRowProps) {
  const { t } = useTranslation();
  const isWarmup = set.is_warmup;

  const effectiveMetric: FailureMetricEnum =
    set.failure_metric !== 'none' ? set.failure_metric : defaultFailureMetric;

  // Local editable state — changes go to the DB only on confirm (✓)
  const [weightStr, setWeightStr] = useState(
    set.weight_value != null ? String(set.weight_value) : '',
  );
  const [repsStr, setRepsStr] = useState(set.reps != null ? String(set.reps) : '');
  const [failureValStr, setFailureValStr] = useState(() => {
    if (effectiveMetric === 'rir') return set.rir != null ? String(set.rir) : '';
    if (effectiveMetric === 'rpe') return set.rpe != null ? String(set.rpe) : '';
    return '';
  });

  // Parse helpers
  const parsedWeight = parseFloat(weightStr);
  const parsedReps = parseInt(repsStr, 10);
  const parsedFailureVal = parseInt(failureValStr, 10);

  const handleConfirm = () => {
    const weight = isNaN(parsedWeight) ? null : parsedWeight;
    const reps = isNaN(parsedReps) ? null : parsedReps;
    const rir = effectiveMetric === 'rir' ? (isNaN(parsedFailureVal) ? null : parsedFailureVal) : set.rir;
    const rpe = effectiveMetric === 'rpe' ? (isNaN(parsedFailureVal) ? null : parsedFailureVal) : set.rpe;

    onConfirm({
      weight_value: weight,
      weight_unit: (userUnit as UnitEnum),
      reps,
      failure_metric: effectiveMetric !== 'none' ? effectiveMetric : 'none',
      rir,
      rpe,
    });
  };

  const warmupOpacity = isWarmup ? 0.55 : 1;

  const weightLabel = isBodyweight ? t('session.added_load_label') : t('session.weight_label');
  const failureLabel = effectiveMetric === 'rpe' ? t('session.rpe_label') : t('session.rir_label');
  const showFailure = effectiveMetric !== 'none';

  const dropGroup = set.drop_group;

  return (
    <View style={[styles.row, isWarmup && styles.rowWarmup, isSelected && styles.rowSelected]}>
      {/* Drop-group indicator */}
      {dropGroup ? <View style={styles.dropIndicator} /> : null}

      {/* Index */}
      <Pressable
        style={styles.indexCell}
        onLongPress={onSelectionToggle}
        accessibilityLabel={t('session.warmup_hint')}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isWarmup }}
      >
        <Text style={[styles.indexText, { opacity: warmupOpacity }]}>
          {isWarmup ? 'C' : String(index + 1)}
        </Text>
      </Pressable>

      {/* Weight */}
      <View style={[styles.fieldCell, styles.fieldCellWide, { opacity: warmupOpacity }]}>
        <NumericField
          value={weightStr}
          onChangeText={setWeightStr}
          onIncrement={() => {
            const cur = isNaN(parsedWeight) ? 0 : parsedWeight;
            const next = cur + 2.5;
            setWeightStr(String(Math.round(next * 4) / 4));
          }}
          onDecrement={() => {
            const cur = isNaN(parsedWeight) ? 0 : parsedWeight;
            const next = Math.max(0, cur - 2.5);
            setWeightStr(String(Math.round(next * 4) / 4));
          }}
          step={2.5}
          minValue={0}
          allowDecimal
          label={weightLabel}
        />
      </View>

      {/* Reps */}
      <View style={[styles.fieldCell, styles.fieldCellWide, { opacity: warmupOpacity }]}>
        <NumericField
          value={repsStr}
          onChangeText={setRepsStr}
          onIncrement={() => {
            const cur = isNaN(parsedReps) ? 0 : parsedReps;
            setRepsStr(String(cur + 1));
          }}
          onDecrement={() => {
            const cur = isNaN(parsedReps) ? 0 : parsedReps;
            setRepsStr(String(Math.max(0, cur - 1)));
          }}
          step={1}
          minValue={0}
          label={t('session.reps_label')}
        />
      </View>

      {/* RIR / RPE */}
      {showFailure ? (
        <View style={[styles.fieldCell, styles.fieldCellNarrow, { opacity: warmupOpacity }]}>
          <NumericField
            value={failureValStr}
            onChangeText={setFailureValStr}
            onIncrement={() => {
              const cur = isNaN(parsedFailureVal) ? 0 : parsedFailureVal;
              const max = effectiveMetric === 'rpe' ? 10 : 5;
              setFailureValStr(String(Math.min(max, cur + 1)));
            }}
            onDecrement={() => {
              const cur = isNaN(parsedFailureVal) ? 0 : parsedFailureVal;
              setFailureValStr(String(Math.max(0, cur - 1)));
            }}
            step={1}
            minValue={0}
            label={failureLabel}
          />
        </View>
      ) : (
        <View style={styles.fieldCellNarrow} />
      )}

      {/* Confirm ✓ */}
      <Pressable
        onPress={handleConfirm}
        style={styles.confirmButton}
        accessibilityRole="button"
        accessibilityLabel={t('session.confirm_set')}
        hitSlop={8}
      >
        <Ionicons
          name="checkmark-circle"
          size={28}
          color={colors.success}
        />
      </Pressable>

      {/* Long-press: warmup toggle & delete are handled via selection/menu */}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    position: 'relative',
  },
  rowWarmup: {
    backgroundColor: colors.surfaceAlt,
  },
  rowSelected: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceAlt,
  },
  dropIndicator: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  indexCell: {
    width: 24,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  fieldCell: {
    alignItems: 'center',
  },
  fieldCellWide: {
    flex: 3,
  },
  fieldCellNarrow: {
    flex: 2,
  },
  confirmButton: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
