/**
 * RoutinePickerSheet — TKT-0053
 *
 * A bottom-sheet Modal listing all user routines.
 * Tapping a routine calls onSelect(routine).
 * If no routines exist, shows a nudge with a CTA to the Routines tab.
 */

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';
import type { RoutineRow } from '@/db';

interface Props {
  visible: boolean;
  routines: RoutineRow[];
  onSelect: (routine: RoutineRow) => void;
  onCancel: () => void;
  /** Called when user has no routines and taps the "create routine" nudge. */
  onCreateRoutine: () => void;
}

export function RoutinePickerSheet({
  visible,
  routines,
  onSelect,
  onCancel,
  onCreateRoutine,
}: Props) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      >
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{t('home.routine_picker_title')}</Text>

          {routines.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyText}>{t('home.routine_picker_empty')}</Text>
              <Pressable
                onPress={() => {
                  onCancel();
                  onCreateRoutine();
                }}
                style={styles.createBtn}
                accessibilityRole="button"
                accessibilityLabel={t('home.routine_picker_create')}
              >
                <Text style={styles.createBtnText}>{t('home.routine_picker_create')}</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              alwaysBounceVertical={false}
              keyboardShouldPersistTaps="handled"
            >
              {routines.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => onSelect(r)}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel={r.name}
                >
                  <Text style={styles.routineName} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.chevron}>{'›'}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Pressable
            onPress={onCancel}
            style={styles.cancelBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '60%',
  },
  title: {
    ...typography.label,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.md,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  routineName: {
    flex: 1,
    ...typography.section,
    color: colors.textPrimary,
    fontSize: 16,
  },
  chevron: {
    ...typography.title,
    color: colors.textTertiary,
    fontSize: 20,
  },
  emptyBlock: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  createBtn: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    ...typography.section,
    color: colors.onAccent,
    fontSize: 15,
  },
  cancelBtn: {
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  cancelBtnText: {
    ...typography.section,
    color: colors.textSecondary,
  },
});
