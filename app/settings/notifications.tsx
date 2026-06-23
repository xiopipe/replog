/**
 * TKT-0062 — Notification Settings screen.
 *
 * Route: app/settings/notifications.tsx
 *        (linked from the Settings tab via a row press)
 *
 * Master toggle + per-type toggles:
 *   - Workout reminders + time picker (DateTimePicker)
 *   - Inactivity re-engagement
 *   - PR celebration
 *
 * Permission flow (contextual — NOT on cold launch):
 *   - Not granted yet: toggles disabled + explanatory prompt.
 *   - First master-toggle enable: request POST_NOTIFICATIONS at that moment.
 *   - Permanently denied: message + link to System Settings; toggles stay disabled.
 *   - Granted: toggles fully interactive.
 *
 * React-19 rule: NO synchronous setState in useEffect.
 * All state derivation is done via useMemo; all async work in event handlers.
 */

import DateTimePicker from '@react-native-community/datetimepicker';
import * as Linking from 'expo-linking';
import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';
import { useNotificationPrefs } from '@/features/notifications/useNotificationPrefs';
import type { NotificationPrefs } from '@/db';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SettingRow({
  label,
  hint,
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <View style={rowStyles.container}>
      <View style={rowStyles.text}>
        <Text style={[rowStyles.label, disabled && rowStyles.labelDisabled]}>{label}</Text>
        {hint ? (
          <Text style={rowStyles.hint}>{hint}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={disabled ? undefined : onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.onAccent}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        style={rowStyles.switch}
      />
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
  },
  labelDisabled: {
    color: colors.textTertiary,
  },
  hint: {
    ...typography.label,
    color: colors.textSecondary,
  },
  switch: {
    // Ensure minimum touch area
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignSelf: 'center',
  },
});

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={sectionStyles.title}>{title}</Text>
  );
}

const sectionStyles = StyleSheet.create({
  title: {
    ...typography.label,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 11,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Permission state shape
// ---------------------------------------------------------------------------

interface PermState {
  granted: boolean;
  canAskAgain: boolean;
  checked: boolean;
}

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { prefs, setPrefs, isLoading } = useNotificationPrefs();

  const [permState, setPermState] = useState<PermState>({
    granted: false,
    canAskAgain: true,
    checked: false,
  });
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Load current permission status on mount (async resolve, not synchronous setState).
  useEffect(() => {
    let cancelled = false;
    getPermissionsAsync().then((status) => {
      if (!cancelled) {
        setPermState({
          granted: status.granted,
          canAskAgain: status.canAskAgain,
          checked: true,
        });
      }
    }).catch(() => {
      if (!cancelled) {
        setPermState({ granted: false, canAskAgain: true, checked: true });
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Parse reminder time string "HH:mm" into a Date for DateTimePicker.
  const reminderDate = useMemo(() => {
    const [h, m] = (prefs.workoutReminders.time ?? '18:00').split(':').map(Number);
    const d = new Date();
    d.setHours(h ?? 18, m ?? 0, 0, 0);
    return d;
  }, [prefs.workoutReminders.time]);

  // Permission state derivation.
  const isGranted = permState.granted;
  const isPermanentlyDenied = !permState.granted && !permState.canAskAgain && permState.checked;

  // Toggles are only interactive when permission is granted.
  const togglesDisabled = !isGranted;

  // Per-type toggles are also non-interactive when master is off.
  const subTogglesDisabled = togglesDisabled || !prefs.enabled;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleMasterToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        // Requesting permission on first enable (contextual).
        if (!isGranted) {
          const result = await requestPermissionsAsync();
          setPermState({
            granted: result.granted,
            canAskAgain: result.canAskAgain,
            checked: true,
          });
          if (!result.granted) {
            // Permission denied — don't enable master.
            return;
          }
        }
        // First enable: write defaults including all sub-toggles on.
        const patch: NotificationPrefs = {
          enabled: true,
          workoutReminders: {
            enabled: prefs.workoutReminders.enabled,
            time: prefs.workoutReminders.time,
          },
          inactivity: { enabled: prefs.inactivity.enabled },
          prCelebration: { enabled: prefs.prCelebration.enabled },
        };
        setPrefs(patch);
      } else {
        setPrefs({ enabled: false });
      }
    },
    [isGranted, prefs, setPrefs],
  );

  const handleRemindersToggle = useCallback(
    (value: boolean) => {
      setPrefs({
        workoutReminders: { ...prefs.workoutReminders, enabled: value },
      });
    },
    [prefs.workoutReminders, setPrefs],
  );

  const handleInactivityToggle = useCallback(
    (value: boolean) => {
      setPrefs({ inactivity: { enabled: value } });
    },
    [setPrefs],
  );

  const handlePRToggle = useCallback(
    (value: boolean) => {
      setPrefs({ prCelebration: { enabled: value } });
    },
    [setPrefs],
  );

  const handleTimeChange = useCallback(
    (_event: unknown, date?: Date) => {
      if (Platform.OS === 'android') {
        setShowTimePicker(false);
      }
      if (!date) return;
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      setPrefs({
        workoutReminders: { ...prefs.workoutReminders, time: `${hh}:${mm}` },
      });
    },
    [prefs.workoutReminders, setPrefs],
  );

  const handleOpenSystemSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          hitSlop={8}
        >
          <Text style={styles.backLabel}>‹</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('settings.notif_title')}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Permission banner */}
        {isPermanentlyDenied ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{t('settings.notif_permission_denied')}</Text>
            <Pressable
              onPress={handleOpenSystemSettings}
              style={styles.bannerButton}
              accessibilityRole="button"
              accessibilityLabel={t('settings.notif_open_system_settings')}
            >
              <Text style={styles.bannerButtonText}>
                {t('settings.notif_open_system_settings')}
              </Text>
            </Pressable>
          </View>
        ) : !isGranted ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>{t('settings.notif_permission_prompt')}</Text>
          </View>
        ) : null}

        {/* Master toggle */}
        <View style={styles.masterSection}>
          <SettingRow
            label={t('settings.notif_master_label')}
            value={prefs.enabled}
            onValueChange={handleMasterToggle}
            disabled={isPermanentlyDenied}
            accessibilityLabel={t('settings.notif_master_label')}
          />
        </View>

        {/* Workout reminders */}
        <SectionHeader title={t('settings.notif_section_reminders')} />
        <View style={styles.section}>
          <SettingRow
            label={t('settings.notif_reminders_label')}
            hint={subTogglesDisabled ? t('settings.notif_disabled_master_off') : t('settings.notif_reminders_hint')}
            value={prefs.workoutReminders.enabled}
            onValueChange={handleRemindersToggle}
            disabled={subTogglesDisabled}
            accessibilityLabel={t('settings.notif_reminders_label')}
          />

          {/* Time picker row */}
          <View style={styles.timeRow}>
            <Text
              style={[
                styles.timeLabel,
                (subTogglesDisabled || !prefs.workoutReminders.enabled) && styles.timeLabelDisabled,
              ]}
            >
              {t('settings.notif_reminder_time_label')}
            </Text>
            <Pressable
              onPress={() => {
                if (!subTogglesDisabled && prefs.workoutReminders.enabled) {
                  setShowTimePicker(true);
                }
              }}
              style={[
                styles.timeButton,
                (subTogglesDisabled || !prefs.workoutReminders.enabled) && styles.timeButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${t('settings.notif_reminder_time_label')}: ${prefs.workoutReminders.time}`}
              disabled={subTogglesDisabled || !prefs.workoutReminders.enabled}
            >
              <Text
                style={[
                  styles.timeValue,
                  (subTogglesDisabled || !prefs.workoutReminders.enabled) && styles.timeValueDisabled,
                ]}
              >
                {prefs.workoutReminders.time}
              </Text>
            </Pressable>
          </View>

          {showTimePicker ? (
            <DateTimePicker
              value={reminderDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
              accessibilityLabel={t('settings.notif_reminder_time_label')}
            />
          ) : null}
        </View>

        {/* Other notification types */}
        <SectionHeader title={t('settings.notif_section_other')} />
        <View style={styles.section}>
          <SettingRow
            label={t('settings.notif_inactivity_label')}
            hint={subTogglesDisabled ? t('settings.notif_disabled_master_off') : t('settings.notif_inactivity_hint')}
            value={prefs.inactivity.enabled}
            onValueChange={handleInactivityToggle}
            disabled={subTogglesDisabled}
            accessibilityLabel={t('settings.notif_inactivity_label')}
          />
          <View style={styles.divider} />
          <SettingRow
            label={t('settings.notif_pr_label')}
            hint={subTogglesDisabled ? t('settings.notif_disabled_master_off') : t('settings.notif_pr_hint')}
            value={prefs.prCelebration.enabled}
            onValueChange={handlePRToggle}
            disabled={subTogglesDisabled}
            accessibilityLabel={t('settings.notif_pr_label')}
          />
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  backLabel: {
    ...typography.title,
    color: colors.accent,
    fontSize: 28,
    lineHeight: 32,
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
  banner: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  bannerText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  bannerButton: {
    alignSelf: 'flex-start',
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
  },
  bannerButtonText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
  infoBanner: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  infoBannerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  masterSection: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: -spacing.md,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  timeLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  timeLabelDisabled: {
    color: colors.textTertiary,
  },
  timeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeButtonDisabled: {
    opacity: 0.4,
  },
  timeValue: {
    ...typography.section,
    color: colors.accent,
    fontWeight: '600',
  },
  timeValueDisabled: {
    color: colors.textTertiary,
  },
});
