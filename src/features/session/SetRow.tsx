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
 *
 * TKT-0061: RIR/RPE state is null (unset) vs 0 (explicit). Placeholder "—" shown when null.
 * TKT-0019: weight → reps → RIR/RPE focus chain; last field "done" commits the set.
 * TKT-0046: ⓘ icon next to RIR/RPE stepper opens equivalence guide modal.
 * TKT-0050: Haptics on confirm (called by parent via onConfirm callback).
 */

import { useState, useRef, useCallback } from 'react';
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
import { parseDecimalFloat } from '@/lib/parseDecimal';
import {
  incrementFailureVal,
  decrementFailureVal,
} from './setRowHelpers';
import { RirGuideModal } from './RirGuideModal';

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
  onToggleWarmup?: () => void;
  onToggleReachedFailure?: () => void;
  /**
   * TKT-0019: when provided, the PREVIOUS row's reps field can forward focus
   * to this row's weight field.
   */
  weightRef?: React.RefObject<TextInput | null>;
}

// ---------------------------------------------------------------------------
// NumericField — weight / reps stepper input
// ---------------------------------------------------------------------------

interface NumericFieldProps {
  value: string;
  onChangeText: (v: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  step: number;
  minValue: number;
  allowDecimal?: boolean;
  label: string;
  inputRef?: React.RefObject<TextInput | null>;
  returnKeyType?: 'next' | 'done';
  onSubmitEditing?: () => void;
}

function NumericField({
  value,
  onChangeText,
  onIncrement,
  onDecrement,
  allowDecimal,
  label,
  inputRef,
  returnKeyType = 'done',
  onSubmitEditing,
}: NumericFieldProps) {
  const { t } = useTranslation();
  return (
    <View style={fieldStyles.wrapper}>
      <Pressable
        onPress={onDecrement}
        style={fieldStyles.stepper}
        accessibilityLabel={t('common.decrement', { label })}
        hitSlop={4}
      >
        <Ionicons name="remove" size={14} color={colors.textSecondary} />
      </Pressable>
      <TextInput
        ref={inputRef as React.RefObject<TextInput>}
        style={fieldStyles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
        selectTextOnFocus
        accessibilityLabel={label}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
      <Pressable
        onPress={onIncrement}
        style={fieldStyles.stepper}
        accessibilityLabel={t('common.increment', { label })}
        hitSlop={4}
      >
        <Ionicons name="add" size={14} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// TKT-0061 — RIR/RPE nullable stepper display
// ---------------------------------------------------------------------------

interface NullableStepperProps {
  /** null = unset; number = explicit value (0 is valid for RIR) */
  value: number | null;
  onIncrement: () => void;
  onDecrement: () => void;
  label: string;
  /** TKT-0046: show ⓘ icon to open guide */
  onInfoPress: () => void;
}

function NullableStepper({
  value,
  onIncrement,
  onDecrement,
  label,
  onInfoPress,
}: NullableStepperProps) {
  const { t } = useTranslation();
  return (
    <View style={fieldStyles.nullableWrapper}>
      <View style={fieldStyles.wrapper}>
        <Pressable
          onPress={onDecrement}
          style={fieldStyles.stepper}
          accessibilityLabel={t('common.decrement', { label })}
          hitSlop={4}
        >
          <Ionicons name="remove" size={14} color={colors.textSecondary} />
        </Pressable>
        {/* TKT-0061: show "—" placeholder when value is null */}
        <View style={fieldStyles.nullableDisplay}>
          <Text
            style={[
              fieldStyles.nullableValue,
              value === null && fieldStyles.nullablePlaceholder,
            ]}
            accessibilityLabel={value === null ? t('session.rir_unset_a11y') : label + ' ' + String(value)}
          >
            {value === null ? '—' : String(value)}
          </Text>
        </View>
        <Pressable
          onPress={onIncrement}
          style={fieldStyles.stepper}
          accessibilityLabel={t('common.increment', { label })}
          hitSlop={4}
        >
          <Ionicons name="add" size={14} color={colors.textSecondary} />
        </Pressable>
      </View>
      {/* TKT-0046: ⓘ info icon */}
      <Pressable
        onPress={onInfoPress}
        style={fieldStyles.infoButton}
        accessibilityRole="button"
        accessibilityLabel={t('session.rir_guide_a11y')}
        hitSlop={6}
      >
        <Ionicons name="information-circle-outline" size={17} color={colors.textTertiary} />
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
  // NullableStepper
  nullableWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nullableDisplay: {
    minWidth: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  nullableValue: {
    ...typography.logNumber,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  nullablePlaceholder: {
    color: colors.textTertiary,
    fontWeight: '400',
  },
  infoButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ---------------------------------------------------------------------------
// SetRow
// ---------------------------------------------------------------------------

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
  onToggleWarmup,
  onToggleReachedFailure,
  weightRef: externalWeightRef,
}: SetRowProps) {
  const { t } = useTranslation();
  const isWarmup = set.is_warmup;

  const effectiveMetric: FailureMetricEnum =
    set.failure_metric !== 'none' ? set.failure_metric : defaultFailureMetric;

  // ── TKT-0019: refs for focus chain ──────────────────────────────────────
  const internalWeightRef = useRef<TextInput | null>(null);
  const weightInputRef = externalWeightRef ?? internalWeightRef;
  const repsRef = useRef<TextInput | null>(null);

  // Local editable state — changes go to the DB only on confirm (✓).
  // Re-seeded from prop via `key={set.id}:{set.updated_at}` at render site
  // (never with a setState-in-effect).
  const [weightStr, setWeightStr] = useState(
    set.weight_value != null ? String(set.weight_value) : '',
  );
  const [repsStr, setRepsStr] = useState(set.reps != null ? String(set.reps) : '');

  // TKT-0061: nullable RIR/RPE — null = unset, distinct from 0
  const [failureVal, setFailureVal] = useState<number | null>(() => {
    if (effectiveMetric === 'rir') return set.rir ?? null;
    if (effectiveMetric === 'rpe') return set.rpe ?? null;
    return null;
  });

  // TKT-0046: guide modal
  const [guideVisible, setGuideVisible] = useState(false);
  const openGuide = useCallback(() => setGuideVisible(true), []);
  const closeGuide = useCallback(() => setGuideVisible(false), []);

  // Parse helpers
  const parsedWeight = parseDecimalFloat(weightStr);
  const parsedReps = parseInt(repsStr, 10);

  const handleConfirm = useCallback(() => {
    const weight = isNaN(parsedWeight) ? null : parsedWeight;
    const reps = isNaN(parsedReps) ? null : parsedReps;
    // TKT-0061: preserve null in confirm — failureVal is already null or a number
    const rir = effectiveMetric === 'rir' ? failureVal : set.rir;
    const rpe = effectiveMetric === 'rpe' ? failureVal : set.rpe;

    onConfirm({
      weight_value: weight,
      weight_unit: (userUnit as UnitEnum),
      reps,
      failure_metric: effectiveMetric !== 'none' ? effectiveMetric : 'none',
      rir,
      rpe,
    });
  }, [parsedWeight, parsedReps, effectiveMetric, failureVal, set.rir, set.rpe, userUnit, onConfirm]);

  // TKT-0019: "done" on last field (reps when metric=none, or stepper confirm)
  const handleRepsDone = useCallback(() => {
    if (effectiveMetric === 'none') {
      // Reps is the last field — commit immediately
      handleConfirm();
    }
    // If metric ≠ none, reps has returnKeyType="next" and focus goes to stepper;
    // since the stepper is not a TextInput, we just dismiss keyboard and wait for ✓.
    // The user still taps ✓ (or uses the done button) to commit.
  }, [effectiveMetric, handleConfirm]);

  const warmupOpacity = isWarmup ? 0.55 : 1;

  const weightLabel = isBodyweight ? t('session.added_load_label') : t('session.weight_label');
  const failureLabel = effectiveMetric === 'rpe' ? t('session.rpe_label') : t('session.rir_label');
  const showFailure = effectiveMetric !== 'none';

  const dropGroup = set.drop_group;
  const reachedFailure = set.reached_failure;

  return (
    <View style={[styles.row, isWarmup && styles.rowWarmup, isSelected && styles.rowSelected]}>
      {/* TKT-0046: guide modal — rendered outside the row layout */}
      <RirGuideModal visible={guideVisible} onDismiss={closeGuide} />

      {/* Drop-group indicator */}
      {dropGroup ? <View style={styles.dropIndicator} /> : null}

      {/* Index / warmup toggle */}
      <Pressable
        style={styles.indexCell}
        onPress={onSelectionToggle ? undefined : onToggleWarmup}
        onLongPress={onSelectionToggle}
        accessibilityLabel={t('session.mark_warmup')}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isWarmup }}
      >
        <Text style={[styles.indexText, isWarmup && styles.indexTextWarmup, { opacity: warmupOpacity }]}>
          {isWarmup ? t('session.warmup') : String(index + 1)}
        </Text>
      </Pressable>

      {/* Weight — TKT-0019: returnKeyType="next", focuses reps on submit */}
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
          inputRef={weightInputRef}
          returnKeyType="next"
          onSubmitEditing={() => repsRef.current?.focus()}
        />
      </View>

      {/* Reps — TKT-0019: returnKeyType="next" or "done" depending on metric */}
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
          inputRef={repsRef}
          returnKeyType={showFailure ? 'next' : 'done'}
          onSubmitEditing={handleRepsDone}
        />
      </View>

      {/* RIR / RPE — TKT-0061 nullable stepper, TKT-0046 info icon */}
      {showFailure ? (
        <View style={[styles.fieldCell, styles.fieldCellNarrow, { opacity: warmupOpacity }]}>
          <NullableStepper
            value={failureVal}
            onIncrement={() =>
              setFailureVal(incrementFailureVal(failureVal, effectiveMetric))
            }
            onDecrement={() =>
              setFailureVal(decrementFailureVal(failureVal, effectiveMetric))
            }
            label={failureLabel}
            onInfoPress={openGuide}
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

      {/* Reached-failure chip — TKT-0021 */}
      {onToggleReachedFailure ? (
        <Pressable
          onPress={onToggleReachedFailure}
          style={[styles.failureChip, reachedFailure && styles.failureChipActive]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: reachedFailure }}
          accessibilityLabel={t('session.reached_failure_toggle')}
          hitSlop={4}
        >
          <Ionicons
            name={reachedFailure ? 'flame' : 'flame-outline'}
            size={12}
            color={reachedFailure ? colors.error : colors.textTertiary}
          />
          <Text style={[styles.failureChipText, reachedFailure && styles.failureChipTextActive]}>
            {t('session.reached_failure_label')}
          </Text>
        </Pressable>
      ) : null}

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
  indexTextWarmup: {
    color: colors.accent,
    fontWeight: '700',
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
  failureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    minHeight: TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  failureChipActive: {
    borderColor: colors.error,
    backgroundColor: colors.surfaceAlt,
  },
  failureChipText: {
    ...typography.label,
    fontSize: 10,
    color: colors.textTertiary,
  },
  failureChipTextActive: {
    color: colors.error,
    fontWeight: '600',
  },
});
