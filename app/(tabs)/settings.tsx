/**
 * Settings screen — unit preference, failure metric, optional profile context,
 * account / sign out.
 *
 * All values persist to the user's profile row via updateProfile() from
 * src/features/settings/profile.ts — written to the local observable (offline-first).
 *
 * Design-UX.md §Settings:
 *   kg/lb unit toggle
 *   default_failure_metric (rir/rpe/none)
 *   Optional profile context: experience_level, available_days_per_week,
 *     preferred_weekdays, equipment, priority_muscles, limitations
 *   Account / sign out
 */

import { use$ } from '@legendapp/state/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type {
  ExperienceEnum,
  FailureMetricEnum,
  MuscleEnum,
  UnitEnum,
} from '@/db';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';
import { Button } from '@/components/Button';
import { MultiSelect } from '@/components/MultiSelect';
import { getProfile, updateProfile } from '@/features/settings/profile';

// ---------------------------------------------------------------------------
// Small generic toggle row (segmented control with 2–3 options)
// ---------------------------------------------------------------------------

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel?: string;
}) {
  return (
    <View
      style={segStyles.row}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
    >
      {options.map((opt, idx) => {
        const isActive = opt.value === value;
        const isFirst = idx === 0;
        const isLast = idx === options.length - 1;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              segStyles.segment,
              isFirst && segStyles.segFirst,
              isLast && segStyles.segLast,
              isActive && segStyles.segActive,
              pressed && !isActive && segStyles.segPressed,
            ]}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ checked: isActive }}
          >
            <Text style={[segStyles.label, isActive && segStyles.labelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const segStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  segment: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  segFirst: {},
  segLast: { borderRightWidth: 0 },
  segActive: { backgroundColor: colors.accent },
  segPressed: { opacity: 0.7 },
  label: { ...typography.label, color: colors.textSecondary, fontSize: 14 },
  labelActive: { color: colors.onAccent, fontWeight: '600' },
});

// ---------------------------------------------------------------------------
// Settings section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={secStyles.container}>
      <Text style={secStyles.title}>{title}</Text>
      {children}
    </View>
  );
}

function RowLabel({ label }: { label: string }) {
  return <Text style={secStyles.label}>{label}</Text>;
}

const secStyles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.label,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 11,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const MUSCLE_ENUM_VALUES: MuscleEnum[] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'quads',
  'hamstrings_glutes',
  'calves',
  'core',
];

const EQUIPMENT_VALUES = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'other',
];

const EXPERIENCE_OPTIONS: ExperienceEnum[] = ['beginner', 'intermediate', 'advanced'];

const WEEKDAY_INDICES = [0, 1, 2, 3, 4, 5, 6];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { db, session, signOut } = useAuth();
  const userId = session?.user?.id ?? '';

  const rawProfiles = use$(db?.profiles$);

  const profile = useMemo(
    () => (rawProfiles ? getProfile(rawProfiles, userId) : null),
    [rawProfiles, userId],
  );

  if (!db || rawProfiles == null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // Current values (fall back to defaults if profile row not yet synced)
  const unitPref: UnitEnum = profile?.unit_preference ?? 'kg';
  const failureMetric: FailureMetricEnum = profile?.default_failure_metric ?? 'rir';
  const experienceLevel: ExperienceEnum | null = profile?.experience_level ?? null;
  const availableDays: number = profile?.available_days_per_week ?? 3;
  const preferredWeekdays: number[] = profile?.preferred_weekdays ?? [];
  const equipment: string[] = profile?.equipment ?? [];
  const priorityMuscles: MuscleEnum[] = profile?.priority_muscles ?? [];
  const limitations: string = profile?.limitations ?? '';

  // Helper
  const save = (patch: Parameters<typeof updateProfile>[2]) => {
    if (!db) return;
    updateProfile(db, userId, patch);
  };

  const unitOptions: SegmentOption<UnitEnum>[] = [
    { value: 'kg', label: t('settings.unit_kg') },
    { value: 'lb', label: t('settings.unit_lb') },
  ];

  const metricOptions: SegmentOption<FailureMetricEnum>[] = [
    { value: 'rir', label: t('settings.metric_rir') },
    { value: 'rpe', label: t('settings.metric_rpe') },
    { value: 'none', label: t('settings.metric_none') },
  ];

  const experienceOptions: SegmentOption<ExperienceEnum>[] = EXPERIENCE_OPTIONS.map((v) => ({
    value: v,
    label: t(`settings.experience_${v}`),
  }));

  const muscleOptions = MUSCLE_ENUM_VALUES.map((m) => ({
    key: m,
    label: t(`muscles.${m}`),
  }));

  const equipmentOptions = EQUIPMENT_VALUES.map((e) => ({
    key: e,
    label: t(`equipment.${e}`),
  }));

  const weekdayOptions = WEEKDAY_INDICES.map((i) => ({
    key: String(i),
    label: t(`weekdays.${i}`),
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('settings.title')}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* --- Training preferences --- */}
        <Section title={t('settings.section_training')}>
          <View>
            <RowLabel label={t('settings.unit')} />
            <SegmentedControl
              options={unitOptions}
              value={unitPref}
              onChange={(v) => save({ unit_preference: v })}
              accessibilityLabel={t('settings.unit')}
            />
          </View>

          <View>
            <RowLabel label={t('settings.failure_metric')} />
            <SegmentedControl
              options={metricOptions}
              value={failureMetric}
              onChange={(v) => save({ default_failure_metric: v })}
              accessibilityLabel={t('settings.failure_metric')}
            />
          </View>
        </Section>

        {/* --- Profile context (optional) --- */}
        <Section title={t('settings.section_profile')}>
          <View>
            <RowLabel label={t('settings.experience_level')} />
            <SegmentedControl
              options={experienceOptions}
              value={experienceLevel ?? 'beginner'}
              onChange={(v) => save({ experience_level: v })}
              accessibilityLabel={t('settings.experience_level')}
            />
          </View>

          {/* Days per week */}
          <View>
            <RowLabel label={`${t('settings.available_days')} (${availableDays})`} />
            <View style={styles.daysRow}>
              <Pressable
                onPress={() => save({ available_days_per_week: Math.max(1, availableDays - 1) })}
                style={styles.daysStepper}
                accessibilityRole="button"
                accessibilityLabel={t('common.decrement', { label: t('settings.available_days') })}
              >
                <Text style={styles.daysStepperLabel}>−</Text>
              </Pressable>
              <Text style={styles.daysValue}>{availableDays}</Text>
              <Pressable
                onPress={() => save({ available_days_per_week: Math.min(7, availableDays + 1) })}
                style={styles.daysStepper}
                accessibilityRole="button"
                accessibilityLabel={t('common.increment', { label: t('settings.available_days') })}
              >
                <Text style={styles.daysStepperLabel}>+</Text>
              </Pressable>
            </View>
          </View>

          {/* Preferred weekdays */}
          <View>
            <RowLabel label={t('settings.preferred_weekdays')} />
            <MultiSelect
              options={weekdayOptions}
              selected={preferredWeekdays.map(String)}
              onToggle={(key) => {
                const idx = Number(key);
                const current = preferredWeekdays;
                const next = current.includes(idx)
                  ? current.filter((d) => d !== idx)
                  : [...current, idx].sort((a, b) => a - b);
                save({ preferred_weekdays: next });
              }}
              accessibilityLabel={t('settings.preferred_weekdays')}
            />
          </View>

          {/* Equipment */}
          <View>
            <RowLabel label={t('settings.equipment')} />
            <MultiSelect
              options={equipmentOptions}
              selected={equipment}
              onToggle={(key) => {
                const next = equipment.includes(key)
                  ? equipment.filter((e) => e !== key)
                  : [...equipment, key];
                save({ equipment: next });
              }}
              accessibilityLabel={t('settings.equipment')}
            />
          </View>

          {/* Priority muscles */}
          <View>
            <RowLabel label={t('settings.priority_muscles')} />
            <MultiSelect
              options={muscleOptions}
              selected={priorityMuscles}
              onToggle={(key) => {
                const m = key as MuscleEnum;
                const next: MuscleEnum[] = priorityMuscles.includes(m)
                  ? priorityMuscles.filter((x) => x !== m)
                  : [...priorityMuscles, m];
                save({ priority_muscles: next });
              }}
              accessibilityLabel={t('settings.priority_muscles')}
            />
          </View>

          {/* Limitations / injuries */}
          <View>
            <RowLabel label={t('settings.limitations')} />
            <TextInput
              style={styles.textarea}
              value={limitations}
              onChangeText={(v) => save({ limitations: v })}
              placeholder={t('settings.limitations_placeholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
              returnKeyType="done"
              blurOnSubmit
              accessibilityLabel={t('settings.limitations')}
            />
          </View>
        </Section>

        {/* --- Account --- */}
        <Section title={t('settings.account')}>
          <Text style={styles.emailLabel}>{session?.user?.email ?? ''}</Text>
          <Button
            label={t('auth.logout')}
            variant="secondary"
            onPress={() => signOut()}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  daysStepper: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysStepperLabel: {
    ...typography.section,
    color: colors.textPrimary,
  },
  daysValue: {
    ...typography.section,
    color: colors.textPrimary,
    minWidth: 32,
    textAlign: 'center',
  },
  textarea: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  emailLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
