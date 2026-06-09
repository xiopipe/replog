/**
 * History tab — past sessions grouped by ISO week (most recent first).
 *
 * Each session row shows: weekday + date, duration (mm:ss), sets per muscle
 * (fractional volume), and a PR badge if any set in that session was a PR.
 *
 * Wireframe: docs/UI-Mockups/history.svg
 */

import { use$ } from '@legendapp/state/react';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getISOWeek, getISOWeekYear } from 'date-fns';

import { globalExerciseMuscles$ } from '@/db';
import type { MuscleEnum, WorkoutSessionRow, ExerciseMuscleRow, SessionExerciseRow, SetRow } from '@/db';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';
import { EmptyState } from '@/components/EmptyState';
import { getMusclesForExercise } from '@/features/catalog/queries';
import {
  getSessionExercises,
  summarizeSession,
} from '@/features/session/queries';
import type { MusclesBySessionExerciseId } from '@/lib/hypertrophy';
import { formatMmSs } from '@/features/session/SessionTimer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns an ISO "YYYY-Www" week key (e.g. "2024-W03") for grouping. */
function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const year = getISOWeekYear(d);
  const week = String(getISOWeek(d)).padStart(2, '0');
  return `${year}-W${week}`;
}

/** Human label for a week key relative to now. */
function weekLabel(key: string, t: (k: string) => string): string {
  const nowKey = isoWeekKey(new Date().toISOString());
  if (key === nowKey) return t('history.this_week');
  const now = new Date();
  const prevWeekDate = new Date(now);
  prevWeekDate.setDate(now.getDate() - 7);
  const prevKey = isoWeekKey(prevWeekDate.toISOString());
  if (key === prevKey) return t('history.last_week');
  return `${t('history.week_of')} ${key.slice(5)}`;
}

/** Short weekday + date label for a session row */
function sessionDateLabel(dateStr: string, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const d = new Date(dateStr);
  let wd = d.getDay() - 1;
  if (wd < 0) wd = 6; // Sunday
  const wdLabel = t(`weekdays.${wd}`);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${wdLabel} ${day}/${month}`;
}

/** Build the muscle-by-session-exercise map for a given session. */
function buildMusclesBySeId(
  sessionId: string,
  sessionExercises: Record<string, SessionExerciseRow>,
  globalMuscles: Record<string, ExerciseMuscleRow>,
  userMuscles: Record<string, ExerciseMuscleRow>,
): MusclesBySessionExerciseId {
  const seList = getSessionExercises(sessionExercises, sessionId);
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
// Session row
// ---------------------------------------------------------------------------

interface MuscleVolume {
  muscle: MuscleEnum;
  /** Fractional sets, rounded to nearest 0.5 for display */
  sets: number;
}

interface SessionRowData {
  session: WorkoutSessionRow;
  durationMs: number | null;
  effectiveSets: number;
  topMuscles: MuscleVolume[];
  hasPR: boolean;
}

function SessionCard({ data, onPress }: { data: SessionRowData; onPress: () => void }) {
  const { t } = useTranslation();
  const { session, durationMs, effectiveSets, topMuscles, hasPR } = data;

  const durationLabel =
    durationMs != null ? formatMmSs(Math.floor(durationMs / 1000)) : '--:--';

  const dateLabel = sessionDateLabel(session.started_at, t);
  const muscleLabels = topMuscles
    .slice(0, 3)
    .map(({ muscle, sets }) => `${t(`muscles.${muscle}`)} ${sets}`)
    .join(' · ');

  const sessionName = session.name ?? t('history.unnamed_session');

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${sessionName}, ${dateLabel}, ${durationLabel}`}
    >
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {sessionName}
        </Text>
        {hasPR && (
          <View style={styles.prBadge} accessibilityLabel={t('history.pr_badge')}>
            <Ionicons name="trophy" size={11} color={colors.warning} style={styles.prTrophyIcon} />
            <Text style={styles.prBadgeText}>{t('history.pr_badge')}</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardMetaText}>
        {`${dateLabel} · ${durationLabel} · ${effectiveSets} ${t('history.sets_abbr')}`}
      </Text>
      {muscleLabels.length > 0 && (
        <Text style={styles.cardMuscles} numberOfLines={1}>
          {muscleLabels}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Computed sections hook (called unconditionally before any early return)
// ---------------------------------------------------------------------------

interface WeekSection {
  title: string;
  key: string;
  data: SessionRowData[];
}

function useSections(
  sessions: Record<string, WorkoutSessionRow>,
  sessionExercises: Record<string, SessionExerciseRow>,
  sets: Record<string, SetRow>,
  globalMuscles: Record<string, ExerciseMuscleRow>,
  userMuscles: Record<string, ExerciseMuscleRow>,
  t: (k: string) => string,
): WeekSection[] {
  return useMemo(() => {
    const completed: WorkoutSessionRow[] = Object.values(sessions)
      .filter((s) => s.status === 'completed' && !s.deleted_at)
      .sort((a, b) => b.started_at.localeCompare(a.started_at));

    if (completed.length === 0) return [];

    const rowDataMap: Record<string, SessionRowData> = {};
    for (const s of completed) {
      const musclesBySeId = buildMusclesBySeId(s.id, sessionExercises, globalMuscles, userMuscles);
      const summary = summarizeSession(s, sessionExercises, sets, sessions, musclesBySeId);

      const topMuscles: MuscleVolume[] = (
        Object.entries(summary.volumeByMuscle) as [MuscleEnum, number][]
      )
        .sort((a, b) => b[1] - a[1])
        .map(([muscle, vol]) => ({
          muscle,
          // Round fractional volume to nearest 0.5
          sets: Math.round(vol * 2) / 2,
        }));

      rowDataMap[s.id] = {
        session: s,
        durationMs: summary.durationMs,
        effectiveSets: summary.effectiveSets,
        topMuscles,
        hasPR: summary.prSetIds.length > 0,
      };
    }

    const weekMap: Record<string, SessionRowData[]> = {};
    for (const s of completed) {
      const key = isoWeekKey(s.started_at);
      if (!weekMap[key]) weekMap[key] = [];
      weekMap[key].push(rowDataMap[s.id]!);
    }

    const sortedKeys = Object.keys(weekMap).sort((a, b) => b.localeCompare(a));
    return sortedKeys.map((key) => ({
      title: weekLabel(key, t),
      key,
      data: weekMap[key]!,
    }));
  }, [sessions, sessionExercises, sets, globalMuscles, userMuscles, t]);
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { db } = useAuth();

  const rawSessions = use$(db?.workoutSessions$);
  const rawSessionExercises = use$(db?.sessionExercises$);
  const rawSets = use$(db?.sets$);
  const globalMuscles = use$(globalExerciseMuscles$);
  const rawUserMuscles = use$(db?.userExerciseMuscles$);

  // Compute sections unconditionally (before any early return)
  const sections = useSections(
    rawSessions ?? {},
    rawSessionExercises ?? {},
    rawSets ?? {},
    globalMuscles ?? {},
    rawUserMuscles ?? {},
    t,
  );

  // Loading guard
  if (!db || rawSessions == null || rawSessionExercises == null || rawSets == null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {t('history.title')}
          </Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (sections.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {t('history.title')}
          </Text>
        </View>
        <EmptyState message={t('history.empty')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('history.title')}
        </Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.session.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <SessionCard
            data={item}
            onPress={() => router.push(`/history/${item.session.id}`)}
          />
        )}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
  listContent: {
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    ...typography.label,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    minHeight: TOUCH_TARGET + spacing.lg,
  },
  cardPressed: {
    opacity: 0.8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    ...typography.section,
    color: colors.textPrimary,
    flex: 1,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginLeft: spacing.sm,
    gap: 3,
  },
  prTrophyIcon: {
    // marginRight handled by gap
  },
  prBadgeText: {
    ...typography.label,
    color: colors.warning,
    fontWeight: '600',
  },
  cardMetaText: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 13,
  },
  cardMuscles: {
    ...typography.label,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    fontSize: 12,
  },
});
