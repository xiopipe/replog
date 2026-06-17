/**
 * StaleSessionModal — recovery prompt for a session reopened after a long gap
 * (TKT-0011).
 *
 * When an in-progress session is reopened and its last activity was more than
 * STALE_SESSION_THRESHOLD_HOURS ago, the live timer may be misleading. We ask
 * the user how to proceed instead of silently resuming:
 *
 *   - Continue            → resume the timer from the current accumulated value.
 *   - Finish with real    → enter the real elapsed minutes, then finish. (Until
 *     duration              TKT-0030 adds in-summary editing, the minutes are
 *                           captured here and written to the accumulator.)
 *   - Discard session     → soft-delete the session and return Home.
 *
 * Centered dialog (not a bottom sheet): this is a decision gate, not a menu.
 */

import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';

export interface StaleSessionModalProps {
  visible: boolean;
  onContinue: () => void;
  /** Receives the real workout duration in seconds. */
  onFinishWithDuration: (seconds: number) => void;
  onDiscard: () => void;
}

export function StaleSessionModal({
  visible,
  onContinue,
  onFinishWithDuration,
  onDiscard,
}: StaleSessionModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'choices' | 'duration'>('choices');
  const [minutes, setMinutes] = useState('');

  const reset = useCallback(() => {
    setMode('choices');
    setMinutes('');
  }, []);

  const handleContinue = useCallback(() => {
    reset();
    onContinue();
  }, [reset, onContinue]);

  const handleDiscard = useCallback(() => {
    reset();
    onDiscard();
  }, [reset, onDiscard]);

  const handleConfirmDuration = useCallback(() => {
    const parsed = Math.max(0, Math.floor(Number(minutes.replace(',', '.')) || 0));
    reset();
    onFinishWithDuration(parsed * 60);
  }, [minutes, reset, onFinishWithDuration]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Decision gate: the Android back button must NOT silently dismiss it
      // (that would leave staleDismissed=false and re-show on the next render).
      onRequestClose={() => {}}
    >
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal={true}>
          {mode === 'choices' ? (
            <>
              <Text style={styles.title}>{t('session.stale_title')}</Text>
              <Text style={styles.body}>{t('session.stale_body')}</Text>

              <Pressable
                style={styles.primaryBtn}
                onPress={handleContinue}
                accessibilityRole="button"
                accessibilityLabel={t('session.stale_continue')}
              >
                <Text style={styles.primaryText}>{t('session.stale_continue')}</Text>
              </Pressable>

              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setMode('duration')}
                accessibilityRole="button"
                accessibilityLabel={t('session.stale_finish_real')}
              >
                <Text style={styles.secondaryText}>{t('session.stale_finish_real')}</Text>
              </Pressable>

              <Pressable
                style={styles.secondaryBtn}
                onPress={handleDiscard}
                accessibilityRole="button"
                accessibilityLabel={t('session.stale_discard')}
              >
                <Text style={styles.destructiveText}>{t('session.stale_discard')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('session.stale_duration_title')}</Text>
              <Text style={styles.body}>{t('session.stale_duration_body')}</Text>

              <TextInput
                style={styles.input}
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="number-pad"
                autoFocus
                placeholder={t('session.stale_duration_placeholder')}
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel={t('session.stale_duration_a11y_label')}
                returnKeyType="done"
                onSubmitEditing={handleConfirmDuration}
              />

              <Pressable
                style={styles.primaryBtn}
                onPress={handleConfirmDuration}
                accessibilityRole="button"
                accessibilityLabel={t('session.stale_duration_confirm')}
              >
                <Text style={styles.primaryText}>{t('session.stale_duration_confirm')}</Text>
              </Pressable>

              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setMode('choices')}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.section,
    color: colors.textPrimary,
    fontSize: 17,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    minHeight: TOUCH_TARGET,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
  },
  primaryBtn: {
    minHeight: TOUCH_TARGET,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { ...typography.section, color: colors.onAccent, fontSize: 15 },
  secondaryBtn: {
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { ...typography.body, color: colors.textSecondary },
  destructiveText: { ...typography.body, color: colors.error },
});
