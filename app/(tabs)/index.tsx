/**
 * Home tab — today's plan, weekly strip, and quick start button.
 *
 * States:
 *  - No active plan → CTA to choose a template
 *  - Active plan with today's routine → routine card + "Empezar entreno" (placeholder)
 *  - Active plan, today = rest → rest message
 */
import { use$ } from '@legendapp/state/react';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { colors, spacing, typography } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { getActivePlan, getWeekdaySummaries } from '@/features/routines/queries';

// Today's weekday: JS getDay() is 0=Sun, but our schema is 0=Mon.
// Convert: Mon=0, Tue=1, …, Sun=6
function getTodayWeekday(): number {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  return jsDay === 0 ? 6 : jsDay - 1;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { db, session } = useAuth();

  const rawPlans = use$(db?.plans$);
  const rawPlanDays = use$(db?.planDays$);
  const rawRoutines = use$(db?.routines$);
  const rawRoutineExercises = use$(db?.routineExercises$);

  const isLoading = !db;

  const activePlan = useMemo(() => getActivePlan(rawPlans ?? {}), [rawPlans]);

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

  const todayIndex = getTodayWeekday();
  const todaySummary = weekdays[todayIndex];

  const displayName = session?.user?.user_metadata?.full_name
    ?? session?.user?.email?.split('@')[0]
    ?? '';

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // No active plan
  if (!activePlan) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.greetingRow}>
            {displayName ? (
              <Text style={styles.greeting}>
                {t('home.greeting')}, {displayName}
              </Text>
            ) : null}
          </View>
          <Text style={styles.headline}>{t('home.no_plan_title')}</Text>
          <Text style={styles.noPlanSub}>{t('home.no_plan_cta')}</Text>
          <Button
            label={t('home.choose_template')}
            onPress={() => router.push('/plan/templates')}
            style={styles.ctaBtn}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Has active plan
  const todayHasRoutine = todaySummary?.routine !== null;
  const todayRoutine = todaySummary?.routine;
  const todayExerciseCount = todaySummary?.exerciseCount ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Greeting */}
        {displayName ? (
          <Text style={styles.greeting}>
            {t('home.greeting')}, {displayName}
          </Text>
        ) : null}
        <Text style={styles.headline}>
          {todayHasRoutine ? t('home.today_trains') : t('home.today_rest')}
        </Text>

        {/* Weekly strip */}
        <WeeklyStrip weekdays={weekdays} todayIndex={todayIndex} t={t} />

        {/* Today's routine card */}
        {todayHasRoutine && todayRoutine ? (
          <Card style={styles.routineCard}>
            <Text style={styles.routineCardLabel}>{t('home.todays_routine')}</Text>
            <Text style={styles.routineCardName}>{todayRoutine.name}</Text>
            <Text style={styles.routineCardMeta}>
              {t('home.exercises_count_one', { count: todayExerciseCount })}
            </Text>
            {/* Phase 3 placeholder — button is visible but disabled */}
            <Button
              label={t('home.start_workout')}
              onPress={() => {
                // Phase 3: will navigate to active session
              }}
              disabled
              style={styles.startBtn}
            />
          </Card>
        ) : (
          <Card style={styles.restCard}>
            <Text style={styles.restCardText}>{t('home.today_rest')}</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Weekly strip: 7 circles, today highlighted
// ---------------------------------------------------------------------------

function WeeklyStrip({
  weekdays,
  todayIndex,
  t,
}: {
  weekdays: ReturnType<typeof getWeekdaySummaries>;
  todayIndex: number;
  t: (key: string) => string;
}) {
  return (
    <View style={styles.strip} accessibilityRole="none">
      {weekdays.map((d) => {
        const isToday = d.weekday === todayIndex;
        const hasRoutine = d.routine !== null;

        return (
          <View
            key={d.weekday}
            style={styles.stripItem}
            accessible
            accessibilityLabel={`${t(`weekdays.${d.weekday}`)}: ${d.routine?.name ?? t('weekly_plan.rest')}`}
          >
            <Text style={styles.stripDayLabel}>{t(`weekdays_short.${d.weekday}`)}</Text>
            <View
              style={[
                styles.stripCircle,
                hasRoutine && styles.stripCircleActive,
                isToday && styles.stripCircleToday,
              ]}
            >
              <Text
                style={[
                  styles.stripCircleText,
                  !hasRoutine && styles.stripCircleTextRest,
                  isToday && styles.stripCircleTextToday,
                ]}
                numberOfLines={1}
              >
                {d.routine ? d.routine.name.charAt(0).toUpperCase() : '·'}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    flexGrow: 1,
  },
  greetingRow: { gap: 2 },
  greeting: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 13,
  },
  headline: {
    ...typography.title,
    color: colors.textPrimary,
    fontSize: 21,
    marginTop: -spacing.sm,
  },
  noPlanSub: {
    ...typography.body,
    color: colors.textSecondary,
  },
  ctaBtn: {
    marginTop: spacing.md,
  },

  // Weekly strip
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stripItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  stripDayLabel: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 11,
  },
  stripCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripCircleActive: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.accent,
  },
  stripCircleToday: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  stripCircleText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  stripCircleTextRest: {
    color: colors.textTertiary,
  },
  stripCircleTextToday: {
    color: colors.onAccent,
  },

  // Routine card
  routineCard: {
    gap: spacing.sm,
  },
  routineCardLabel: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 12,
  },
  routineCardName: {
    ...typography.title,
    color: colors.textPrimary,
    fontSize: 19,
  },
  routineCardMeta: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
  },
  startBtn: {
    marginTop: spacing.sm,
  },

  // Rest card
  restCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  restCardText: {
    ...typography.section,
    color: colors.textTertiary,
  },
});
