/**
 * Exercise detail screen.
 * Shows the muscle figure, instructions ("How to" tab), and best 1RM card.
 * History tab: past sets for this exercise + best estimated 1RM.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useRows, globalExercises$, globalExerciseMuscles$ } from '@/db';
import type { SetRow as SetRowData } from '@/db';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';
import { getMusclesForExercise } from '@/features/catalog/queries';
import { MuscleFigure } from '@/features/catalog/MuscleFigure';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { getExerciseHistorySets, getUserUnitPreference } from '@/features/session/queries';
import { estimated1RM } from '@/lib/hypertrophy';

type TabKey = 'how_to' | 'history';

export default function ExerciseDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [activeTab, setActiveTab] = useState<TabKey>('how_to');

  const { db, session: authSession } = useAuth();
  const userId = authSession?.user?.id ?? '';

  const globalExercises = useRows(globalExercises$);
  const globalMuscles = useRows(globalExerciseMuscles$);
  const rawUserExercises = useRows(db?.userExercises$);
  const rawUserMuscles = useRows(db?.userExerciseMuscles$);
  const rawSets = useRows(db?.sets$);
  const rawSessionExercises = useRows(db?.sessionExercises$);
  const rawProfiles = useRows(db?.profiles$);

  const exercise = useMemo(
    () =>
      (globalExercises ?? {})[id] ??
      (rawUserExercises ?? {})[id] ??
      null,
    [globalExercises, rawUserExercises, id],
  );

  const muscles = useMemo(
    () =>
      exercise
        ? getMusclesForExercise(globalMuscles ?? {}, rawUserMuscles ?? {}, id)
        : [],
    [exercise, globalMuscles, rawUserMuscles, id],
  );

  const userUnit = useMemo(
    () => getUserUnitPreference(rawProfiles ?? {}, userId),
    [rawProfiles, userId],
  );

  // History sets for this exercise (all working sets across all sessions)
  const historySets = useMemo<SetRowData[]>(
    () =>
      rawSets != null && rawSessionExercises != null
        ? getExerciseHistorySets(rawSets, rawSessionExercises, id)
        : [],
    [rawSets, rawSessionExercises, id],
  );

  // Best estimated 1RM across history working sets
  const bestE1RM = useMemo<number | null>(() => {
    if (historySets.length === 0) return null;
    let best = 0;
    for (const s of historySets) {
      if (s.weight_kg == null || s.reps == null || s.reps < 1) continue;
      const e1 = estimated1RM(s.weight_kg, s.reps);
      if (e1 > best) best = e1;
    }
    return best > 0 ? best : null;
  }, [historySets]);

  // Group history sets by session_exercise_id to show per-session grouping
  // Sort sets descending by performed_at (most recent first)
  const sortedHistory = useMemo<SetRowData[]>(
    () =>
      [...historySets].sort((a, b) =>
        b.performed_at.localeCompare(a.performed_at),
      ),
    [historySets],
  );

  // Show a loading indicator while the global observables haven't synced yet.
  // Without this guard, a valid exercise id would falsely hit the not-found
  // empty state because globalExercises/globalMuscles are null before first sync.
  if (globalExercises == null || globalMuscles == null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!exercise) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('exercise.detail_title')}
          </Text>
          <View style={styles.backButton} />
        </View>
        <EmptyState message={t('catalog.not_found')} />
      </SafeAreaView>
    );
  }

  const primaryMuscles = muscles.filter((m) => m.role === 'primary');
  const secondaryMuscles = muscles.filter((m) => m.role === 'secondary');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {exercise.name}
        </Text>
        <View style={styles.backButton} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar} accessibilityRole="tablist">
        <Pressable
          style={[styles.tab, activeTab === 'how_to' && styles.tabActive]}
          onPress={() => setActiveTab('how_to')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'how_to' }}
          accessibilityLabel={t('exercise.tab_how_to')}
        >
          <Text style={[styles.tabLabel, activeTab === 'how_to' && styles.tabLabelActive]}>
            {t('exercise.tab_how_to')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'history' }}
          accessibilityLabel={t('exercise.tab_history')}
        >
          <Text style={[styles.tabLabel, activeTab === 'history' && styles.tabLabelActive]}>
            {t('exercise.tab_history')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Muscle figure */}
        <View style={styles.figureContainer}>
          <MuscleFigure muscles={muscles} scale={1.3} />
        </View>

        {/* Muscle legend */}
        <View style={styles.legend}>
          {primaryMuscles.length > 0 && (
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors.musclePrimary }]} />
              <Text style={styles.legendText}>
                {`${t('exercise.primary_label')}: `}
                {primaryMuscles.map((m) => t(`muscles.${m.muscle}`)).join(', ')}
              </Text>
            </View>
          )}
          {secondaryMuscles.length > 0 && (
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors.muscleSecondary }]} />
              <Text style={styles.legendText}>
                {`${t('exercise.secondary_label')}: `}
                {secondaryMuscles.map((m) => t(`muscles.${m.muscle}`)).join(', ')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {activeTab === 'how_to' && (
          <>
            {/* Instructions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('exercise.how_to_label')}</Text>
              <Text style={styles.instructions}>
                {exercise.instructions ?? t('exercise.no_instructions')}
              </Text>
            </View>

            {/* Best 1RM card */}
            <Card style={styles.card1rm}>
              <Text style={styles.card1rmLabel}>{t('exercise.best_mark')}</Text>
              {bestE1RM != null ? (
                <Text style={styles.card1rmValue}>
                  {`${Math.round(bestE1RM * 10) / 10} ${userUnit}`}
                </Text>
              ) : (
                <Text style={styles.card1rmEmpty}>{t('exercise.no_records')}</Text>
              )}
            </Card>

            {/* View history button */}
            <Button
              label={t('exercise.view_history')}
              variant="secondary"
              onPress={() => setActiveTab('history')}
              style={styles.historyButton}
            />
          </>
        )}

        {activeTab === 'history' && (
          sortedHistory.length === 0 ? (
            <EmptyState message={t('exercise.no_records')} />
          ) : (
            <View style={styles.historySection}>
              {/* Best mark summary */}
              {bestE1RM != null && (
                <Card style={styles.card1rm}>
                  <Text style={styles.card1rmLabel}>{t('exercise.best_mark')}</Text>
                  <Text style={styles.card1rmValue}>
                    {`${Math.round(bestE1RM * 10) / 10} ${userUnit}`}
                  </Text>
                </Card>
              )}

              {/* Set history list */}
              <Text style={styles.historyListTitle}>{t('exercise.history_sets_title')}</Text>
              {sortedHistory.map((s) => {
                const weightDisplay =
                  s.weight_value != null
                    ? `${s.weight_value} ${s.weight_unit ?? userUnit}`
                    : `—`;
                const rirLabel =
                  s.failure_metric === 'rir' && s.rir != null
                    ? ` @ ${s.rir} ${t('session.rir_label')}`
                    : s.failure_metric === 'rpe' && s.rpe != null
                    ? ` @ ${t('session.rpe_label')} ${s.rpe}`
                    : '';
                const date = new Date(s.performed_at);
                const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
                return (
                  <View key={s.id} style={styles.historySetRow}>
                    <Text style={styles.historySetMain}>
                      {`${weightDisplay} × ${s.reps ?? '—'}${rirLabel}`}
                    </Text>
                    <Text style={styles.historySetDate}>{dateStr}</Text>
                  </View>
                );
              })}
            </View>
          )
        )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
  },
  tabActive: {
    borderBottomWidth: 2.5,
    borderBottomColor: colors.accent,
  },
  tabLabel: {
    ...typography.body,
    color: colors.textTertiary,
  },
  tabLabelActive: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  figureContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  section: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.textPrimary,
  },
  instructions: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  card1rm: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card1rmLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  card1rmEmpty: {
    ...typography.body,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  historyButton: {
    marginHorizontal: spacing.lg,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  card1rmValue: {
    ...typography.section,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  historySection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  historyListTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  historySetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historySetMain: {
    ...typography.body,
    color: colors.textPrimary,
  },
  historySetDate: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 12,
  },
});
