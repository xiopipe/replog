/**
 * OnboardingModal — TKT-0043
 *
 * One-screen post-register prompt shown after first-time registration.
 * Not a separate route — rendered as an overlay (RN Modal) from the root layout
 * so it does not interfere with the navigation stack.
 *
 * Questions:
 *   1. Preferred weight unit: kg / lb
 *   2. Default failure metric: RIR / RPE / none (optional)
 *
 * Confirm → saves selections to profile → closes modal.
 * Skip    → closes modal WITHOUT persisting (defaults remain in effect;
 *            Settings nudge will appear until the user explicitly saves).
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { FailureMetricEnum, UnitEnum } from '@/db';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';
import { Button } from '@/components/Button';

// ---------------------------------------------------------------------------
// Segmented control (local, avoids importing the Settings-only component)
// ---------------------------------------------------------------------------

interface SegOpt<T extends string> {
  value: T;
  label: string;
}

function SegCtrl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: SegOpt<T>[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel: string;
}) {
  return (
    <View style={seg.row} accessibilityLabel={accessibilityLabel} accessibilityRole="radiogroup">
      {options.map((opt, idx) => {
        const isActive = opt.value === value;
        const isLast = idx === options.length - 1;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              seg.btn,
              isLast && seg.btnLast,
              isActive && seg.btnActive,
            ]}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ checked: isActive }}
          >
            <Text style={[seg.label, isActive && seg.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const seg = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  btn: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  btnLast: { borderRightWidth: 0 },
  btnActive: { backgroundColor: colors.accent },
  label: { ...typography.body, color: colors.textSecondary, fontSize: 14 },
  labelActive: { color: colors.onAccent, fontWeight: '600' },
});

// ---------------------------------------------------------------------------
// Props + component
// ---------------------------------------------------------------------------

export interface OnboardingModalProps {
  visible: boolean;
  /** Called when the user confirms with their chosen values. */
  onConfirm: (unit: UnitEnum, metric: FailureMetricEnum) => void;
  /** Called when the user taps Skip (no values persisted). */
  onSkip: () => void;
}

export function OnboardingModal({ visible, onConfirm, onSkip }: OnboardingModalProps) {
  const { t } = useTranslation();

  const [unit, setUnit] = useState<UnitEnum>('kg');
  const [metric, setMetric] = useState<FailureMetricEnum>('rir');

  const unitOptions: SegOpt<UnitEnum>[] = [
    { value: 'kg', label: t('settings.unit_kg') },
    { value: 'lb', label: t('settings.unit_lb') },
  ];

  const metricOptions: SegOpt<FailureMetricEnum>[] = [
    { value: 'rir', label: t('settings.metric_rir') },
    { value: 'rpe', label: t('settings.metric_rpe') },
    { value: 'none', label: t('settings.metric_none') },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Title */}
          <Text style={styles.title} accessibilityRole="header">
            {t('onboarding.title')}
          </Text>
          <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>

          {/* Q1: Weight unit */}
          <View style={styles.question}>
            <Text style={styles.questionLabel}>{t('onboarding.unit_label')}</Text>
            <SegCtrl
              options={unitOptions}
              value={unit}
              onChange={setUnit}
              accessibilityLabel={t('onboarding.unit_label')}
            />
          </View>

          {/* Q2: Failure metric (optional) */}
          <View style={styles.question}>
            <Text style={styles.questionLabel}>{t('onboarding.metric_label')}</Text>
            <Text style={styles.questionHint}>{t('onboarding.metric_hint')}</Text>
            <SegCtrl
              options={metricOptions}
              value={metric}
              onChange={setMetric}
              accessibilityLabel={t('onboarding.metric_label')}
            />
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              label={t('onboarding.confirm')}
              onPress={() => onConfirm(unit, metric)}
              style={styles.confirmBtn}
            />
            <Pressable
              onPress={onSkip}
              style={styles.skipBtn}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.skip')}
            >
              <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg * 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    width: '100%',
    gap: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    fontSize: 22,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 14,
    marginTop: -spacing.sm,
  },
  question: {
    gap: spacing.sm,
  },
  questionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '500',
    fontSize: 13,
  },
  questionHint: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: -spacing.xs,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  confirmBtn: {},
  skipBtn: {
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 13,
  },
});
