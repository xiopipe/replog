/**
 * Routines tab — hub for weekly plan, routine list, and templates.
 */
import { use$ } from '@legendapp/state/react';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography, TOUCH_TARGET } from '@/lib/theme';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { getActivePlan, getRoutines, getWeekdaySummaries } from '@/features/routines/queries';
import type { RoutineRow } from '@/db';

export default function RoutinesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { db } = useAuth();

  const rawRoutines = use$(db?.routines$);
  const rawPlans = use$(db?.plans$);
  const rawPlanDays = use$(db?.planDays$);
  const rawRoutineExercises = use$(db?.routineExercises$);

  const activePlan = useMemo(() => getActivePlan(rawPlans ?? {}), [rawPlans]);
  const routines = useMemo(() => getRoutines(rawRoutines ?? {}), [rawRoutines]);

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

  const getExerciseCount = (routineId: string): number =>
    Object.values(rawRoutineExercises ?? {}).filter(
      (re) => re.routine_id === routineId && !re.deleted_at,
    ).length;

  return (
    <Screen title={t('routines.title')}>
      <FlatList
        data={routines}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Weekly plan banner */}
            <Pressable
              onPress={() => router.push('/plan')}
              style={({ pressed }) => [styles.planBanner, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityLabel={t('routines.weekly_plan')}
            >
              <View style={styles.planBannerLeft}>
                <Text style={styles.planBannerLabel}>{t('routines.weekly_plan')}</Text>
                {activePlan ? (
                  <Text style={styles.planBannerName} numberOfLines={1}>
                    {activePlan.name}
                  </Text>
                ) : (
                  <Text style={styles.planBannerEmpty}>{t('weekly_plan.no_plan')}</Text>
                )}
                {activePlan && (
                  <WeekdayStrip weekdays={weekdays} t={t} />
                )}
              </View>
              <Text style={styles.planBannerArrow}>{'›'}</Text>
            </Pressable>

            {/* Routines section header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>{t('routines.title')}</Text>
              <Pressable
                onPress={() => router.push('/routines')}
                style={styles.seeAllBtn}
                accessibilityRole="button"
                accessibilityLabel={t('routines.new_routine')}
                hitSlop={8}
              >
                <Text style={styles.seeAllTxt}>{t('routines.new_routine')}</Text>
              </Pressable>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <EmptyState message={t('routines.empty')} />
            <Button
              label={t('templates.title')}
              onPress={() => router.push('/plan/templates')}
              style={styles.templateBtn}
            />
          </View>
        }
        renderItem={({ item }) => (
          <RoutineListItem
            routine={item}
            exerciseCount={getExerciseCount(item.id)}
            onPress={() => router.push(`/routines/editor?id=${item.id}`)}
            t={t}
          />
        )}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Small weekday strip inside the plan banner
// ---------------------------------------------------------------------------

function WeekdayStrip({
  weekdays,
  t,
}: {
  weekdays: ReturnType<typeof getWeekdaySummaries>;
  t: (key: string) => string;
}) {
  return (
    <View style={styles.weekdayStrip}>
      {weekdays.map((d) => (
        <View key={d.weekday} style={styles.weekdayDot}>
          <Text style={styles.weekdayDotLabel}>{t(`weekdays_short.${d.weekday}`)}</Text>
          <View
            style={[styles.weekdayDotCircle, d.routine && styles.weekdayDotCircleActive]}
          />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Routine list item
// ---------------------------------------------------------------------------

function RoutineListItem({
  routine,
  exerciseCount,
  onPress,
  t,
}: {
  routine: RoutineRow;
  exerciseCount: number;
  onPress: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.routineRow, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
      accessibilityLabel={routine.name}
    >
      <View style={styles.routineInfo}>
        <Text style={styles.routineName} numberOfLines={1}>
          {routine.name}
        </Text>
        <Text style={styles.routineCount}>
          {t('routines.exercises_count_one', { count: exerciseCount })}
        </Text>
      </View>
      <Text style={styles.routineChevron}>{'›'}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    flexGrow: 1,
  },
  planBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  planBannerLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  planBannerLabel: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planBannerName: {
    ...typography.section,
    color: colors.textPrimary,
    fontSize: 16,
  },
  planBannerEmpty: {
    ...typography.body,
    color: colors.textTertiary,
    fontSize: 14,
  },
  planBannerArrow: {
    ...typography.title,
    color: colors.textTertiary,
    fontSize: 22,
    marginLeft: spacing.md,
  },
  weekdayStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  weekdayDot: {
    alignItems: 'center',
    gap: 3,
  },
  weekdayDotLabel: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 10,
  },
  weekdayDotCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  weekdayDotCircleActive: {
    backgroundColor: colors.accent,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  seeAllBtn: {
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  seeAllTxt: {
    ...typography.label,
    color: colors.accent,
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    gap: spacing.md,
  },
  templateBtn: {
    marginHorizontal: spacing.lg,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: TOUCH_TARGET,
  },
  routineInfo: {
    flex: 1,
    gap: 2,
  },
  routineName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
    fontSize: 15,
  },
  routineCount: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 12,
  },
  routineChevron: {
    ...typography.title,
    color: colors.textTertiary,
    fontSize: 20,
  },
});
