/**
 * Session detail screen — view and edit a completed session.
 *
 * Shows exercises + their sets (editable via SetRow), allows editing started_at
 * (retroactive date), and displays the session summary (duration, volume by
 * muscle, PRs).
 *
 * Route: /history/[id]  (Stack route; registered in app/_layout.tsx)
 */

import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { openAndroidDateTime } from '@/lib/datetime-picker';
import { useRows } from '@/db';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { globalExercises$, globalExerciseMuscles$ } from '@/db';
import type {
  MuscleEnum,
  UnitEnum,
  FailureMetricEnum,
  SessionExerciseRow,
  ExerciseMuscleRow,
} from '@/db';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';
import { EmptyState } from '@/components/EmptyState';
import { Card } from '@/components/Card';
import { getMusclesForExercise } from '@/features/catalog/queries';
import {
  getSessionExercises,
  getSetsForSessionExercise,
  summarizeSession,
  getUserUnitPreference,
  getUserDefaultFailureMetric,
} from '@/features/session/queries';
import { addSet, updateSet, deleteSet, updateSession } from '@/features/session/mutations';
import { SetRow } from '@/features/session/SetRow';
import type { MusclesBySessionExerciseId } from '@/lib/hypertrophy';
import { formatMmSs } from '@/features/session/SessionTimer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function buildMusclesBySeId(
  seList: SessionExerciseRow[],
  globalMuscles: Record<string, ExerciseMuscleRow>,
  userMuscles: Record<string, ExerciseMuscleRow>,
): MusclesBySessionExerciseId {
  const result: MusclesBySessionExerciseId = {};
  for (const se of seList) {
    const muscles = getMusclesForExercise(globalMuscles, userMuscles, se.exercise_id);
    result[se.id] = muscles.map((m) => ({
      muscle: m.muscle,
      contribution: m.contribution,
    }));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SessionDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();

  const { db, session: authSession } = useAuth();
  const userId = authSession?.user?.id ?? '';

  // Observable reads
  const rawSessions = useRows(db?.workoutSessions$);
  const rawSessionExercises = useRows(db?.sessionExercises$);
  const rawSets = useRows(db?.sets$);
  const rawProfiles = useRows(db?.profiles$);
  const globalExercises = useRows(globalExercises$);
  const rawUserExercises = useRows(db?.userExercises$);
  const globalMuscles = useRows(globalExerciseMuscles$);
  const rawUserMuscles = useRows(db?.userExerciseMuscles$);

  // Local state for editing started_at via native date picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date | null>(null);

  const workout = rawSessions != null ? (rawSessions[sessionId] ?? null) : null;

  const userUnit: UnitEnum = useMemo(
    () => getUserUnitPreference(rawProfiles ?? {}, userId),
    [rawProfiles, userId],
  );

  const defaultMetric: FailureMetricEnum = useMemo(
    () => getUserDefaultFailureMetric(rawProfiles ?? {}, userId),
    [rawProfiles, userId],
  );

  // Sorted exercises for this session (empty if session not found yet)
  const seList = useMemo(
    () =>
      workout && rawSessionExercises
        ? getSessionExercises(rawSessionExercises, sessionId)
        : [],
    [workout, rawSessionExercises, sessionId],
  );

  // Build muscle map for summarizeSession
  const musclesBySeId = useMemo<MusclesBySessionExerciseId>(
    () => buildMusclesBySeId(seList, globalMuscles ?? {}, rawUserMuscles ?? {}),
    [seList, globalMuscles, rawUserMuscles],
  );

  // Session summary
  const summary = useMemo(
    () =>
      workout && rawSessionExercises && rawSets && rawSessions
        ? summarizeSession(
            workout,
            rawSessionExercises,
            rawSets,
            rawSessions,
            musclesBySeId,
          )
        : null,
    [workout, rawSessionExercises, rawSets, rawSessions, musclesBySeId],
  );

  // Stable resolved snapshots (used after loading guard so they're non-null)
  const sets = rawSets ?? {};
  const userExercises = rawUserExercises ?? {};

  // Loading guard
  if (!db || rawSessions == null || rawSessionExercises == null || rawSets == null || globalExercises == null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!workout || workout.deleted_at) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.backBtn} />
        </View>
        <EmptyState message={t('history.session_not_found')} />
      </SafeAreaView>
    );
  }

  const durationLabel =
    summary?.durationMs != null
      ? formatMmSs(Math.floor(summary.durationMs / 1000))
      : '--:--';

  const topMuscles = summary
    ? (Object.entries(summary.volumeByMuscle) as [MuscleEnum, number][]).sort(
        (a, b) => b[1] - a[1],
      )
    : [];

  const sessionName = workout.name ?? t('history.unnamed_session');

  // --- edit started_at via native date picker ---
  const handleOpenDatePicker = () => {
    if (Platform.OS === 'ios') {
      setPickedDate(new Date(workout.started_at));
      setShowDatePicker(true);
      return;
    }
    // Android: imperative date→time picker (component mode="datetime" crashes).
    openAndroidDateTime({
      value: new Date(workout.started_at),
      maximumDate: new Date(),
      onConfirm: (d) => updateSession(db, sessionId, { started_at: d.toISOString() }),
    });
  };

  const handleDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    if (selected) {
      setPickedDate(selected);
      if (Platform.OS !== 'ios') {
        // On Android the picker closes on selection — write immediately
        updateSession(db, sessionId, { started_at: selected.toISOString() });
      }
    }
  };

  const handleConfirmIOSDate = () => {
    if (pickedDate) {
      updateSession(db, sessionId, { started_at: pickedDate.toISOString() });
    }
    setShowDatePicker(false);
  };

  const handleCancelDatePicker = () => {
    setShowDatePicker(false);
    setPickedDate(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {sessionName}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Date / started_at — editable */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('history.date_label')}</Text>
            {showDatePicker && Platform.OS === 'ios' ? (
              <View style={styles.dateEditRow}>
                <DateTimePicker
                  value={pickedDate ?? new Date(workout.started_at)}
                  mode="datetime"
                  display="compact"
                  maximumDate={new Date()}
                  onChange={handleDateChange}
                  themeVariant="dark"
                />
                <Pressable
                  onPress={handleConfirmIOSDate}
                  style={styles.dateSaveBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.save')}
                >
                  <Ionicons name="checkmark" size={18} color={colors.success} />
                </Pressable>
                <Pressable
                  onPress={handleCancelDatePicker}
                  style={styles.dateSaveBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.cancel')}
                >
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={handleOpenDatePicker}
                style={styles.dateRow}
                accessibilityRole="button"
                accessibilityLabel={t('history.edit_date')}
              >
                <Text style={styles.summaryValue}>{formatDateTime(workout.started_at)}</Text>
                <Ionicons
                  name="pencil-outline"
                  size={14}
                  color={colors.textTertiary}
                  style={{ marginLeft: spacing.xs }}
                />
              </Pressable>
            )}
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('summary.duration_label')}</Text>
            <Text style={styles.summaryValue}>{durationLabel}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('summary.effective_sets_label')}</Text>
            <Text style={styles.summaryValue}>{summary?.effectiveSets ?? 0}</Text>
          </View>
        </Card>

        {/* Volume by muscle */}
        {topMuscles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('summary.sets_by_muscle')}</Text>
            {topMuscles.map(([muscle, vol]) => (
              <View key={muscle} style={styles.muscleRow}>
                <Text style={styles.muscleName}>{t(`muscles.${muscle}`)}</Text>
                <Text style={styles.muscleVol}>{Math.round(vol * 2) / 2}</Text>
              </View>
            ))}
          </View>
        )}

        {/* PRs */}
        {summary && summary.prSetIds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('summary.prs_title')}</Text>
            <Text style={styles.prCount}>
              {t('history.pr_count', { count: summary.prSetIds.length })}
            </Text>
          </View>
        )}

        {/* Exercises + sets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('history.exercises_title')}</Text>

          {seList.length === 0 && <EmptyState message={t('session.no_exercises')} />}

          {seList.map((se) => {
            const exercise =
              (globalExercises ?? {})[se.exercise_id] ??
              userExercises[se.exercise_id] ??
              null;
            const exerciseSets = getSetsForSessionExercise(sets, se.id);
            const isBodyweight = exercise?.is_bodyweight ?? false;

            return (
              <View key={se.id} style={styles.exerciseBlock}>
                <Text style={styles.exerciseName} numberOfLines={1}>
                  {exercise?.name ?? t('history.unknown_exercise')}
                </Text>

                {exerciseSets.length === 0 && (
                  <Text style={styles.noSets}>{t('history.no_sets')}</Text>
                )}

                {exerciseSets.map((set, idx) => (
                  <SetRow
                    key={set.id}
                    set={set}
                    index={idx}
                    isBodyweight={isBodyweight}
                    defaultFailureMetric={defaultMetric}
                    userUnit={userUnit}
                    onConfirm={(patch) => {
                      updateSet(db, set.id, {
                        weight_value:
                          patch.weight_value !== undefined
                            ? patch.weight_value
                            : set.weight_value,
                        weight_unit:
                          patch.weight_unit !== undefined
                            ? (patch.weight_unit as UnitEnum)
                            : (set.weight_unit ?? userUnit),
                        reps: patch.reps !== undefined ? patch.reps : set.reps,
                        failure_metric:
                          patch.failure_metric !== undefined
                            ? patch.failure_metric
                            : set.failure_metric,
                        rir: patch.rir !== undefined ? patch.rir : set.rir,
                        rpe: patch.rpe !== undefined ? patch.rpe : set.rpe,
                      });
                    }}
                    onDelete={() => {
                      Alert.alert(t('common.delete'), '', [
                        { text: t('common.cancel'), style: 'cancel' },
                        {
                          text: t('common.delete'),
                          style: 'destructive',
                          onPress: () => deleteSet(db, set.id),
                        },
                      ]);
                    }}
                    onToggleWarmup={() => {
                      updateSet(db, set.id, { is_warmup: !set.is_warmup });
                    }}
                  />
                ))}

                {/* Add set button */}
                <Pressable
                  style={({ pressed }) => [styles.addSetBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    const lastSet = exerciseSets[exerciseSets.length - 1];
                    addSet(db, se.id, {
                      userId,
                      weight_value: lastSet?.weight_value ?? null,
                      weight_unit: lastSet?.weight_unit ?? userUnit,
                      reps: lastSet?.reps ?? null,
                      failure_metric: lastSet?.failure_metric ?? defaultMetric,
                      rir: lastSet?.rir ?? null,
                      rpe: lastSet?.rpe ?? null,
                      is_warmup: false,
                    });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('session.add_set')}
                >
                  <Text style={styles.addSetLabel}>{t('session.add_set')}</Text>
                </Pressable>
              </View>
            );
          })}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.section,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },
  summaryCard: {
    marginHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 13,
  },
  summaryValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateSaveBtn: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  muscleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  muscleName: {
    ...typography.body,
    color: colors.textSecondary,
  },
  muscleVol: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  prCount: {
    ...typography.body,
    color: colors.warning,
  },
  exerciseBlock: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  exerciseName: {
    ...typography.section,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  noSets: {
    ...typography.label,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  addSetBtn: {
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  addSetLabel: {
    ...typography.label,
    color: colors.accent,
    fontWeight: '500',
    fontSize: 13,
  },
});
