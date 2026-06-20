/**
 * Weekly plan screen.
 *
 * Displays 7 weekday rows (Mon=0..Sun=6).
 * Each row shows the assigned routine name or "Descanso" (implicit rest).
 * "Edit" mode allows assigning or clearing routines per day.
 */
import { useRows } from '@/db';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography, TOUCH_TARGET } from '@/lib/theme';
import { getActivePlan, getRoutines, getWeekdaySummaries } from '@/features/routines/queries';
import { assignRoutineToDay, clearDayAssignment } from '@/features/routines/mutations';
import type { WeekdaySummary } from '@/features/routines/queries';
import type { RoutineRow } from '@/db';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';

export default function WeeklyPlanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { db, session } = useAuth();

  const [editMode, setEditMode] = useState(false);
  const [pickingDay, setPickingDay] = useState<number | null>(null);

  const rawPlans = useRows(db?.plans$);
  const rawPlanDays = useRows(db?.planDays$);
  const rawRoutines = useRows(db?.routines$);
  const rawRoutineExercises = useRows(db?.routineExercises$);

  const activePlan = useMemo(
    () => getActivePlan(rawPlans ?? {}),
    [rawPlans],
  );

  const routineList = useMemo(
    () => getRoutines(rawRoutines ?? {}),
    [rawRoutines],
  );

  const weekdays = useMemo(
    () =>
      getWeekdaySummaries(
        rawPlanDays ?? {},
        rawRoutines ?? {},
        rawRoutineExercises ?? {},
        activePlan?.id ?? null,
      ),
    [rawPlanDays, rawRoutines, rawRoutineExercises, activePlan],
  );

  const handleAssign = (weekday: number, routine: RoutineRow) => {
    if (!db || !session || !activePlan) return;
    assignRoutineToDay(db, activePlan.id, routine.id, weekday, session.user.id);
    setPickingDay(null);
  };

  const handleClear = (weekday: number) => {
    if (!db || !activePlan) return;
    clearDayAssignment(db, activePlan.id, weekday);
  };

  // DB not ready yet
  if (!db) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // No active plan → invite to pick template
  if (!activePlan) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Header
          editMode={false}
          onToggleEdit={() => {}}
          onBack={() => router.back()}
          t={t}
          hasActivePlan={false}
        />
        <EmptyState message={t('weekly_plan.no_plan')} />
        <View style={styles.ctaContainer}>
          <Button
            label={t('templates.title')}
            onPress={() => router.push('/plan/templates')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Header
        editMode={editMode}
        onToggleEdit={() => setEditMode((e) => !e)}
        onBack={() => router.back()}
        t={t}
        hasActivePlan
      />

      <FlatList
        data={weekdays}
        keyExtractor={(item) => String(item.weekday)}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          <>
            <Text style={styles.footerNote}>{t('weekly_plan.rest_implicit')}</Text>
            <View style={styles.changeTemplateContainer}>
              <Pressable
                onPress={() => router.push('/plan/templates')}
                style={({ pressed }) => [styles.changeTemplateBtn, pressed && { opacity: 0.75 }]}
                accessibilityRole="button"
                accessibilityLabel={t('weekly_plan.change_template')}
              >
                <Text style={styles.changeTemplateTxt}>{t('weekly_plan.change_template')}</Text>
              </Pressable>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <WeekdayRow
            summary={item}
            editMode={editMode}
            onAssign={() => setPickingDay(item.weekday)}
            onClear={() => handleClear(item.weekday)}
            onOpenRoutine={() =>
              item.routine && router.push(`/routines/editor?id=${item.routine.id}`)
            }
            t={t}
          />
        )}
      />

      {/* Routine picker modal */}
      <RoutinePickerModal
        visible={pickingDay !== null}
        routines={routineList}
        onSelect={(routine) => {
          if (pickingDay !== null) handleAssign(pickingDay, routine);
        }}
        onClose={() => setPickingDay(null)}
        t={t}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({
  editMode,
  onToggleEdit,
  onBack,
  t,
  hasActivePlan,
}: {
  editMode: boolean;
  onToggleEdit: () => void;
  onBack: () => void;
  t: (key: string) => string;
  hasActivePlan: boolean;
}) {
  return (
    <>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          {t('weekly_plan.title')}
        </Text>
        {hasActivePlan && (
          <Pressable
            onPress={onToggleEdit}
            style={styles.editBtn}
            accessibilityRole="button"
            accessibilityLabel={editMode ? t('weekly_plan.done') : t('weekly_plan.edit')}
            hitSlop={8}
          >
            <Text style={styles.editBtnTxt}>
              {editMode ? t('weekly_plan.done') : t('weekly_plan.edit')}
            </Text>
          </Pressable>
        )}
      </View>
      <View style={styles.divider} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Weekday row
// ---------------------------------------------------------------------------

function WeekdayRow({
  summary,
  editMode,
  onAssign,
  onClear,
  onOpenRoutine,
  t,
}: {
  summary: WeekdaySummary;
  editMode: boolean;
  onAssign: () => void;
  onClear: () => void;
  onOpenRoutine: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const hasRoutine = summary.routine !== null;
  // Normal mode: tapping an assigned day opens its routine editor (TKT-0033).
  // Edit mode keeps the assign flow. Rest days in normal mode stay inert.
  const isTappable = editMode || hasRoutine;
  const handlePress = editMode ? onAssign : hasRoutine ? onOpenRoutine : undefined;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.dayRow,
        !hasRoutine && styles.dayRowRest,
        pressed && isTappable && { opacity: 0.75 },
      ]}
      accessibilityRole={isTappable ? 'button' : 'none'}
      accessibilityLabel={
        editMode
          ? t('weekly_plan.assign_routine')
          : `${t(`weekdays.${summary.weekday}`)}: ${summary.routine?.name ?? t('weekly_plan.rest')}`
      }
    >
      {/* Blue left bar for days with a routine */}
      {hasRoutine && <View style={styles.accentBar} />}

      <View style={styles.dayContent}>
        <Text style={styles.dayLabel}>{t(`weekdays.${summary.weekday}`)}</Text>
        <Text
          style={[styles.dayName, !hasRoutine && styles.dayNameRest]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {summary.routine?.name ?? t('weekly_plan.rest')}
        </Text>
      </View>

      {hasRoutine && (
        <Text style={styles.exCount}>
          {t('weekly_plan.exercises_abbr', { count: summary.exerciseCount })}
        </Text>
      )}

      {editMode && (
        <View style={styles.editActions}>
          {hasRoutine && (
            <TouchableOpacity
              onPress={onClear}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('weekly_plan.clear_day')}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
          <Ionicons
            name={hasRoutine ? 'pencil' : 'add-circle-outline'}
            size={20}
            color={colors.accent}
          />
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Routine picker modal
// ---------------------------------------------------------------------------

function RoutinePickerModal({
  visible,
  routines,
  onSelect,
  onClose,
  t,
}: {
  visible: boolean;
  routines: RoutineRow[];
  onSelect: (r: RoutineRow) => void;
  onClose: () => void;
  t: (key: string) => string;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('weekly_plan.assign_routine')}</Text>

          {routines.length === 0 ? (
            <Text style={styles.modalEmpty}>{t('routines.empty')}</Text>
          ) : (
            <FlatList
              data={routines}
              keyExtractor={(r) => r.id}
              style={styles.modalList}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [styles.modalItem, pressed && { opacity: 0.75 }]}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                >
                  <Text style={styles.modalItemText} numberOfLines={1} ellipsizeMode="tail">
                    {item.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </Pressable>
              )}
            />
          )}

          <View style={styles.modalCloseRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.modalCloseTxt}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  backBtn: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.title,
    color: colors.textPrimary,
    flex: 1,
  },
  editBtn: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  editBtnTxt: {
    ...typography.label,
    fontSize: 14,
    color: colors.accent,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  listContent: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 56,
    overflow: 'hidden',
  },
  dayRowRest: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
  },
  dayContent: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  dayLabel: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 12,
  },
  dayName: {
    ...typography.section,
    color: colors.textPrimary,
    fontSize: 15,
  },
  dayNameRest: {
    color: colors.textTertiary,
  },
  exCount: {
    ...typography.label,
    color: colors.textSecondary,
    paddingRight: spacing.md,
    fontSize: 12,
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  clearBtn: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerNote: {
    ...typography.label,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  changeTemplateContainer: {
    paddingBottom: spacing.xl,
  },
  changeTemplateBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  changeTemplateTxt: {
    ...typography.section,
    color: colors.accent,
    fontSize: 14,
  },
  ctaContainer: {
    padding: spacing.lg,
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg * 2,
    borderTopRightRadius: radius.lg * 2,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.section,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  modalList: {
    maxHeight: 320,
  },
  modalEmpty: {
    ...typography.body,
    color: colors.textSecondary,
    padding: spacing.lg,
    textAlign: 'center',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: TOUCH_TARGET,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  modalCloseRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  modalCloseBtn: {
    minHeight: TOUCH_TARGET,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseTxt: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
