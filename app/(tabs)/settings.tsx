/**
 * Settings screen — unit preference, failure metric, optional profile context,
 * account / sign out.
 *
 * All values persist to the user's profile row via updateProfile() from
 * src/features/settings/profile.ts — written to the local observable (offline-first).
 *
 * TKT-0067 additions:
 *   - Show "Crear cuenta" / "Iniciar sesión" CTA for local-only and anonymous users (criteria 10, 11)
 *   - Hide CTA for registered/permanent accounts
 *   - Anonymous sign-out → confirmation dialog with data-loss warning (criterion 13)
 *   - Registered sign-out → plain sign-out, no warning (criterion 14)
 *   - Hide sign-out for local-only users (criterion, per resolved decision C)
 *   - Render guest display-name placeholder when display_name is null (criterion 16)
 *
 * Design-UX.md §Settings:
 *   kg/lb unit toggle
 *   default_failure_metric (rir/rpe/none)
 *   Optional profile context: experience_level, available_days_per_week,
 *     preferred_weekdays, equipment, priority_muscles, limitations
 *   Account / sign out
 */

import { useRows } from '@/db';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import type {
  ExperienceEnum,
  FailureMetricEnum,
  MuscleEnum,
  UnitEnum,
} from '@/db';
import { getIncrementOptions, resolveIncrement } from '@/features/session/setRowHelpers';
import { useAuth } from '@/lib/auth';
import { getAuthVariant, getSettingsAccountState } from '@/lib/rekey';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';
import { Button } from '@/components/Button';
import { MultiSelect } from '@/components/MultiSelect';
import { getProfile, updateProfile } from '@/features/settings/profile';
import { shouldShowProfileNudge } from '@/features/onboarding/onboarding';

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

// ---------------------------------------------------------------------------
// Profile nudge card (TKT-0044)
// ---------------------------------------------------------------------------

function ProfileNudgeCard({
  onTap,
  onDismiss,
}: {
  onTap: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onTap}
      style={nudgeStyles.card}
      accessibilityRole="button"
      accessibilityLabel={t('settings.nudge_body')}
    >
      <View style={nudgeStyles.content}>
        <Text style={nudgeStyles.title}>{t('settings.nudge_title')}</Text>
        <Text style={nudgeStyles.body}>{t('settings.nudge_body')}</Text>
      </View>
      <Pressable
        onPress={onDismiss}
        style={nudgeStyles.dismissBtn}
        accessibilityRole="button"
        accessibilityLabel={t('settings.nudge_dismiss')}
        hitSlop={8}
      >
        <Text style={nudgeStyles.dismissText}>✕</Text>
      </Pressable>
    </Pressable>
  );
}

const nudgeStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    borderLeftWidth: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.label,
    color: colors.accent,
    fontWeight: '600',
    fontSize: 13,
  },
  body: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 12,
  },
  dismissBtn: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    ...typography.body,
    color: colors.textTertiary,
    fontSize: 14,
  },
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { db, session, signOut, activeUid, cloudUid, isAnonymousUser } = useAuth();
  const router = useRouter();

  // Derive account UI state (criteria 10, 11, 13, 14).
  const authVariant = getAuthVariant(cloudUid !== null, isAnonymousUser);
  const accountState = getSettingsAccountState(authVariant);

  // TKT-0067 criterion 16: safe display name — fallback to guest placeholder.
  const displayName = session?.user?.email ?? null;

  // TKT-0044: session-scoped nudge dismiss (may reappear next session if profile still incomplete)
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const profileSectionRef = useRef<ScrollView>(null);

  // For settings, use activeUid (which is cloudUid ?? localUid) for profile lookup.
  const profileUserId = activeUid;

  const rawProfiles = useRows(db?.profiles$);

  const profile = useMemo(
    () => (rawProfiles ? getProfile(rawProfiles, profileUserId) : null),
    [rawProfiles, profileUserId],
  );

  if (rawProfiles == null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // TKT-0044: show the nudge card when profile is incomplete and not dismissed
  const showNudge = !nudgeDismissed && shouldShowProfileNudge(profile);

  // Current values (fall back to defaults if profile row not yet synced)
  const unitPref: UnitEnum = profile?.unit_preference ?? 'kg';
  const failureMetric: FailureMetricEnum = profile?.default_failure_metric ?? 'rir';
  // TKT-0016: weight increment — resolved against the current unit (graceful fallback if stored
  // value is not in the current unit's option list, e.g. after a unit switch).
  const weightIncrement: number = resolveIncrement(profile?.weight_increment ?? null, unitPref);
  const experienceLevel: ExperienceEnum | null = profile?.experience_level ?? null;
  const availableDays: number = profile?.available_days_per_week ?? 3;
  const preferredWeekdays: number[] = profile?.preferred_weekdays ?? [];
  const equipment: string[] = profile?.equipment ?? [];
  const priorityMuscles: MuscleEnum[] = profile?.priority_muscles ?? [];
  const limitations: string = profile?.limitations ?? '';

  // Helper
  const save = (patch: Parameters<typeof updateProfile>[2]) => {
    if (!db) return;
    updateProfile(db, profileUserId, patch);
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

  // TKT-0016: weight increment choices for the current unit.
  // Values are numbers but SegmentedControl is generic over string; we use String(n) as the
  // segment value and parse back on change.
  const incrementOptions: SegmentOption<string>[] = getIncrementOptions(unitPref).map((v) => ({
    value: String(v),
    label: String(v),
  }));

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

  // ---------------------------------------------------------------------------
  // Sign-out handler — distinguishes anonymous (warn dialog) from permanent
  // ---------------------------------------------------------------------------

  function handleSignOut() {
    if (accountState.requireSignOutConfirmation) {
      // Criterion 13: anonymous guest — warn about data loss.
      Alert.alert(
        t('auth.logout'),
        t('auth.guest_signout_warning'),
        [
          {
            text: t('auth.guest_signout_cancel'),
            style: 'cancel',
          },
          {
            text: t('auth.guest_signout_confirm'),
            style: 'destructive',
            onPress: () => signOut(),
          },
        ],
      );
    } else {
      // Criterion 14: permanent account — plain sign-out, no warning.
      signOut();
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('settings.title')}
        </Text>
      </View>

      <ScrollView
        ref={profileSectionRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* TKT-0044: Profile completion nudge card */}
        {showNudge ? (
          <ProfileNudgeCard
            onTap={() => {
              // Scroll to the profile section (top of the Training section)
              profileSectionRef.current?.scrollTo({ y: 0, animated: true });
            }}
            onDismiss={() => setNudgeDismissed(true)}
          />
        ) : null}

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

          {/* TKT-0016: weight increment */}
          <View>
            <RowLabel label={t('settings.weight_increment')} />
            <SegmentedControl
              options={incrementOptions}
              value={String(weightIncrement)}
              onChange={(v) => save({ weight_increment: parseFloat(v) })}
              accessibilityLabel={t('settings.weight_increment_a11y')}
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

        {/* --- Notifications (TKT-0062) --- */}
        <Section title={t('settings.notif_title')}>
          <Pressable
            onPress={() => router.push('/settings/notifications')}
            style={notifRowStyles.row}
            accessibilityRole="button"
            accessibilityLabel={t('settings.notifications_row')}
          >
            <Text style={notifRowStyles.label}>{t('settings.notifications_row')}</Text>
            <Text style={notifRowStyles.chevron}>›</Text>
          </Pressable>
        </Section>

        {/* --- Account (TKT-0067) --- */}
        <Section title={t('settings.account')}>
          {/*
           * Criterion 16: display name with null-safe fallback.
           * For anonymous guests, display_name is null — show localised placeholder.
           * For permanent accounts, show email.
           */}
          <Text style={styles.emailLabel}>
            {displayName ?? t('auth.guest_display_name')}
          </Text>

          {/*
           * Criteria 10, 11: show "Crear cuenta" / "Iniciar sesión" for local-only
           * and anonymous users. Hidden for permanent accounts.
           */}
          {accountState.showCloudAdoptionCta ? (
            <View style={styles.cloudCtaRow}>
              <Button
                label={t('auth.create_account_cta')}
                variant="primary"
                onPress={() => router.push('/(auth)/login')}
              />
              <Button
                label={t('auth.sign_in_cta')}
                variant="secondary"
                onPress={() => router.push('/(auth)/login')}
              />
            </View>
          ) : null}

          {/*
           * Criteria 13, 14: sign-out button.
           * Hidden for local-only users (nothing to sign out of).
           * Anonymous guest → shows warning dialog.
           * Permanent → plain sign-out.
           */}
          {accountState.showSignOut ? (
            <Button
              label={t('auth.logout')}
              variant="secondary"
              onPress={handleSignOut}
            />
          ) : null}
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
  cloudCtaRow: {
    gap: spacing.sm,
  },
});

const notifRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET,
    justifyContent: 'space-between',
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
  },
  chevron: {
    ...typography.title,
    color: colors.textTertiary,
    fontSize: 22,
  },
});
