/**
 * Home tab — today's plan, weekly strip, and quick start button.
 *
 * Phase 3 wiring:
 *  - If there's an in-progress session → show "Reanudar" → navigate to it.
 *  - Today's routine card → "Empezar entreno" → startSessionFromRoutine → navigate.
 *  - "Repetir último" → repeatLastSession → navigate (or show nothing if no history).
 *  - "Registrar entreno pasado" → navigate to retroactive screen.
 *
 * States:
 *  - No active plan → CTA to choose a template
 *  - Active plan with today's routine → routine card + start/resume
 *  - Active plan, today = rest → rest message
 */
import { useRows } from '@/db';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
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

import { useAuth } from '@/lib/auth';
import { colors, spacing, typography, TOUCH_TARGET } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { getActivePlan, getWeekdaySummaries } from '@/features/routines/queries';
import { getActiveSession } from '@/features/session/queries';
import {
  startSessionFromRoutine,
  repeatLastSession,
} from '@/features/session/mutations';
import type { RoutineRow, RoutineExerciseRow } from '@/db';

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

  const rawPlans = useRows(db?.plans$);
  const rawPlanDays = useRows(db?.planDays$);
  const rawRoutines = useRows(db?.routines$);
  const rawRoutineExercises = useRows(db?.routineExercises$);
  const rawSessions = useRows(db?.workoutSessions$);

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

  // Detect active session
  const activeSession = useMemo(
    () => getActiveSession(rawSessions ?? {}),
    [rawSessions],
  );

  // Check if there's any completed session for "repeat last"
  const hasCompletedSession = useMemo(() => {
    if (!rawSessions) return false;
    return Object.values(rawSessions).some(
      (s) => s.status === 'completed' && !s.deleted_at,
    );
  }, [rawSessions]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleResumeSession = () => {
    if (!activeSession) return;
    router.push(`/session/${activeSession.id}`);
  };

  const handleStartFromRoutine = () => {
    if (!db || !session?.user?.id || activeSession) return;

    const todayRoutine = todaySummary?.routine;
    if (!todayRoutine) return;

    // Get routine exercises
    const routineExercises: RoutineExerciseRow[] = Object.values(rawRoutineExercises ?? {}).filter(
      (re) => re.routine_id === todayRoutine.id && !re.deleted_at,
    );

    const sessionId = startSessionFromRoutine(db, todayRoutine as RoutineRow, routineExercises);
    router.push(`/session/${sessionId}`);
  };

  const handleRepeatLast = () => {
    if (!db || !session?.user?.id || activeSession) return;
    const sessionId = repeatLastSession(db, session.user.id);
    if (sessionId) {
      router.push(`/session/${sessionId}`);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // ── No active plan ────────────────────────────────────────────────────────

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

          {/* Resume active session (even without a plan) */}
          {activeSession ? (
            <Pressable
              onPress={handleResumeSession}
              style={styles.resumeBanner}
              accessibilityRole="button"
              accessibilityLabel={t('home.resume_workout')}
            >
              <Text style={styles.resumeBannerText}>{t('home.resume_workout')}</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => router.push('/session/retroactive')}
            style={styles.retroButton}
            accessibilityRole="button"
            accessibilityLabel={t('home.retroactive')}
          >
            <Text style={styles.retroButtonText}>{t('home.retroactive')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Has active plan ───────────────────────────────────────────────────────

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

        {/* Resume active session banner (top priority) */}
        {activeSession ? (
          <Pressable
            onPress={handleResumeSession}
            style={styles.resumeBanner}
            accessibilityRole="button"
            accessibilityLabel={t('home.resume_workout')}
          >
            <Text style={styles.resumeBannerText}>{t('home.resume_workout')}</Text>
          </Pressable>
        ) : null}

        {/* Today's routine card */}
        {todayHasRoutine && todayRoutine ? (
          <Card style={styles.routineCard}>
            <Text style={styles.routineCardLabel}>{t('home.todays_routine')}</Text>
            <Text style={styles.routineCardName}>{todayRoutine.name}</Text>
            <Text style={styles.routineCardMeta}>
              {t('home.exercises_count', { count: todayExerciseCount })}
            </Text>
            <Button
              label={activeSession ? t('home.resume_workout') : t('home.start_workout')}
              onPress={activeSession ? handleResumeSession : handleStartFromRoutine}
              style={styles.startBtn}
            />
          </Card>
        ) : (
          <Card style={styles.restCard}>
            <Text style={styles.restCardText}>{t('home.today_rest')}</Text>
          </Card>
        )}

        {/* Repeat last workout */}
        {hasCompletedSession && !activeSession ? (
          <Pressable
            onPress={handleRepeatLast}
            style={styles.repeatButton}
            accessibilityRole="button"
            accessibilityLabel={t('home.repeat_last')}
          >
            <Text style={styles.repeatButtonText}>{t('home.repeat_last')}</Text>
          </Pressable>
        ) : null}

        {/* Retroactive logging */}
        <Pressable
          onPress={() => router.push('/session/retroactive')}
          style={styles.retroButton}
          accessibilityRole="button"
          accessibilityLabel={t('home.retroactive')}
        >
          <Text style={styles.retroButtonText}>{t('home.retroactive')}</Text>
        </Pressable>
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

  // Resume banner
  resumeBanner: {
    minHeight: TOUCH_TARGET,
    borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  resumeBannerText: {
    ...typography.section,
    color: colors.onAccent,
    fontSize: 14,
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

  // Repeat last button
  repeatButton: {
    minHeight: TOUCH_TARGET,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  repeatButtonText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
  },

  // Retroactive
  retroButton: {
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retroButtonText: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 12,
  },
});
