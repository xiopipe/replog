/**
 * Home tab — today's plan, weekly strip, and quick start button.
 *
 * TKT-0010: Single large primary CTA "Empezar entreno" in the thumb zone (lower
 *   third, ≥56dp, near-full-width) when no session is in progress and today has
 *   a planned routine. One tap → session starts → navigates immediately.
 *
 * TKT-0013: When a session IS in progress → exactly ONE "Reanudar" button with a
 *   context chip (routine name + relative start time, day label if different day).
 *   No duplicate resume controls anywhere on the screen.
 *
 * States:
 *  - No active plan → CTA to choose a template
 *  - Active plan + today's routine + no session → big "Empezar" CTA
 *  - Active plan + today = rest + no session → rest card + secondary "Empezar libre"
 *  - In-progress session (any case) → single "Reanudar" + context chip
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
import { colors, spacing, typography, TOUCH_TARGET, radius } from '@/lib/theme';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { getActivePlan, getWeekdaySummaries } from '@/features/routines/queries';
import { getActiveSession } from '@/features/session/queries';
import {
  startSessionFromRoutine,
  repeatLastSession,
} from '@/features/session/mutations';
import type { RoutineRow, RoutineExerciseRow, WorkoutSessionRow } from '@/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Today's weekday: JS getDay() is 0=Sun, but our schema is 0=Mon.
// Convert: Mon=0, Tue=1, …, Sun=6
function getTodayWeekday(): number {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Returns the weekday index (0=Mon…6=Sun) for a given ISO date string.
 */
function getWeekdayFromISO(iso: string): number {
  const jsDay = new Date(iso).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Compute a relative-time string for the elapsed duration since `startedAt`.
 * Returns keys + interpolation values so callers can use t().
 *
 * Buckets:
 *   < 60 min  → "hace X min"
 *   < 24 h    → "hace X h"
 *   ≥ 24 h    → "hace X d"
 */
export function computeRelativeElapsed(startedAt: string, now: Date = new Date()): {
  key: string;
  count: number;
} {
  const diffMs = now.getTime() - new Date(startedAt).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) {
    return { key: 'home.relative_time_minutes', count: Math.max(diffMin, 1) };
  }
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) {
    return { key: 'home.relative_time_hours', count: diffH };
  }
  return { key: 'home.relative_time_days', count: Math.floor(diffH / 24) };
}

// ---------------------------------------------------------------------------
// Context chip for in-progress session
// ---------------------------------------------------------------------------

interface InProgressChipProps {
  session: WorkoutSessionRow;
  routineName: string | null;
  todayIndex: number;
}

function InProgressChip({ session, routineName, todayIndex }: InProgressChipProps) {
  const { t } = useTranslation();

  const sessionDay = getWeekdayFromISO(session.started_at);
  const isToday = sessionDay === todayIndex;

  const elapsed = computeRelativeElapsed(session.started_at);
  const elapsedStr = t(elapsed.key, { count: elapsed.count });

  const name = routineName ?? '';

  let chipText: string;
  if (isToday) {
    chipText = t('home.in_progress_chip_today', { routineName: name, elapsed: elapsedStr });
  } else {
    const dayLabel = sessionDay === (todayIndex === 0 ? 6 : todayIndex - 1)
      ? t('home.relative_time_yesterday')
      : t(`weekdays.${sessionDay}`);
    chipText = t('home.in_progress_chip_other_day', {
      dayLabel,
      routineName: name,
      elapsed: elapsedStr,
    });
  }

  return (
    <Text
      style={styles.inProgressChip}
      accessibilityRole="text"
      numberOfLines={2}
    >
      {chipText}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

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

  // Detect active session (at most one; offline-first from local observables)
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

  // Resolve the routine name for an in-progress session
  const activeSessionRoutineName = useMemo(() => {
    if (!activeSession?.routine_id) return null;
    const routine = rawRoutines?.[activeSession.routine_id];
    return routine?.name ?? null;
  }, [activeSession, rawRoutines]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleResumeSession = () => {
    if (!activeSession) return;
    router.push(`/session/${activeSession.id}`);
  };

  const handleStartFromRoutine = () => {
    if (!db || !session?.user?.id || activeSession) return;

    const todayRoutine = todaySummary?.routine;
    if (!todayRoutine) return;

    const routineExercises: RoutineExerciseRow[] = Object.values(rawRoutineExercises ?? {}).filter(
      (re) => re.routine_id === todayRoutine.id && !re.deleted_at,
    );

    const sessionId = startSessionFromRoutine(db, todayRoutine as RoutineRow, routineExercises);
    router.push(`/session/${sessionId}`);
  };

  const handleStartUnplanned = () => {
    if (!db || !session?.user?.id || activeSession) return;
    // Start an unplanned session: repeatLastSession creates a blank session if
    // there is no history, or repeats the last one. For an unplanned free
    // workout we navigate to retroactive creation flow instead.
    router.push('/session/retroactive');
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

          {/* Resume active session (even without a plan) — single instance */}
          {activeSession ? (
            <View style={styles.resumeBlock}>
              <Pressable
                onPress={handleResumeSession}
                style={styles.resumeBtn}
                accessibilityRole="button"
                accessibilityLabel={t('home.resume_workout')}
              >
                <Text style={styles.resumeBtnText}>{t('home.resume_workout')}</Text>
              </Pressable>
              <InProgressChip
                session={activeSession}
                routineName={activeSessionRoutineName}
                todayIndex={todayIndex}
              />
            </View>
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

        {/* Today's routine card — info only, no CTA button inside */}
        {todayHasRoutine && todayRoutine ? (
          <Card style={styles.routineCard}>
            <Text style={styles.routineCardLabel}>{t('home.todays_routine')}</Text>
            <Text style={styles.routineCardName}>{todayRoutine.name}</Text>
            <Text style={styles.routineCardMeta}>
              {t('home.exercises_count', { count: todayExerciseCount })}
            </Text>
          </Card>
        ) : (
          <Card style={styles.restCard}>
            <Text style={styles.restCardText}>{t('home.today_rest_card_title')}</Text>
            <Text style={styles.restCardSub}>{t('home.today_rest_cta')}</Text>
          </Card>
        )}

        {/* Repeat last workout — only when no session is in progress */}
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

        {/* ── Primary CTA zone (thumb zone) ─────────────────────────────────
         *
         * TKT-0010 + TKT-0013: exactly ONE action in the lower CTA area.
         *
         * Case A – session in progress: single "Reanudar" + context chip.
         * Case B – no session + today has routine: large "Empezar entreno".
         * Case C – no session + today is rest: secondary "Empezar libre".
         */}
        <View style={styles.ctaZone}>
          {activeSession ? (
            /* Case A — Resume */
            <View style={styles.resumeBlock}>
              <Pressable
                onPress={handleResumeSession}
                style={styles.resumeBtn}
                accessibilityRole="button"
                accessibilityLabel={t('home.resume_workout')}
              >
                <Text style={styles.resumeBtnText}>{t('home.resume_workout')}</Text>
              </Pressable>
              <InProgressChip
                session={activeSession}
                routineName={activeSessionRoutineName}
                todayIndex={todayIndex}
              />
            </View>
          ) : todayHasRoutine ? (
            /* Case B — Start today's routine */
            <Pressable
              onPress={handleStartFromRoutine}
              style={styles.startBtn}
              accessibilityRole="button"
              accessibilityLabel={t('home.start_workout')}
            >
              <Text style={styles.startBtnText}>{t('home.start_workout')}</Text>
            </Pressable>
          ) : (
            /* Case C — Start unplanned (rest day) */
            <Pressable
              onPress={handleStartUnplanned}
              style={styles.startBtnSecondary}
              accessibilityRole="button"
              accessibilityLabel={t('home.start_unplanned')}
            >
              <Text style={styles.startBtnSecondaryText}>{t('home.start_unplanned')}</Text>
            </Pressable>
          )}
        </View>
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

  // Routine card (info only — no CTA inside)
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

  // Rest card
  restCard: {
    gap: spacing.sm,
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  restCardText: {
    ...typography.section,
    color: colors.textTertiary,
  },
  restCardSub: {
    ...typography.body,
    color: colors.textTertiary,
    fontSize: 13,
    textAlign: 'center',
  },

  // Repeat last button
  repeatButton: {
    minHeight: TOUCH_TARGET,
    borderRadius: radius.md,
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

  // ── CTA zone (thumb zone, lower section) ──────────────────────────────────

  ctaZone: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },

  // Primary start button — ≥56dp, near-full-width (TKT-0010)
  startBtn: {
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  startBtnText: {
    ...typography.section,
    color: colors.onAccent,
    fontSize: 17,
    fontWeight: '600',
  },

  // Secondary CTA for rest days
  startBtnSecondary: {
    minHeight: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  startBtnSecondaryText: {
    ...typography.section,
    color: colors.textPrimary,
    fontSize: 17,
  },

  // Resume block — single CTA + context chip (TKT-0013)
  resumeBlock: {
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  resumeBtn: {
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  resumeBtnText: {
    ...typography.section,
    color: colors.onAccent,
    fontSize: 17,
    fontWeight: '600',
  },

  // Context chip beneath the resume button
  inProgressChip: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
