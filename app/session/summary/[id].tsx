/**
 * Session summary screen.
 *
 * Route: /session/summary/[id]  (Stack route)
 *
 * Shown after finishing a session. Displays:
 *   - Success icon + day · routine name
 *   - Duration card + Effective sets card
 *   - Sets per muscle group (fractional volume)
 *   - PRs achieved
 *   - "Hecho" button → navigate home
 *
 * Mirrors session-summary.svg wireframe exactly.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
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

import { useRows, globalExercises$, globalExerciseMuscles$ } from '@/db';
import type { ExerciseRow, MuscleEnum } from '@/db';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';
import { formatDuration } from '@/lib/duration';
import {
  getSessionExercises,
  getUserUnitPreference,
  summarizeSession,
} from '@/features/session/queries';
import { kgToLb, type MusclesBySessionExerciseId } from '@/lib/hypertrophy';

// Ordered muscle display list (8 groups from Exercise-Catalog.md)
const MUSCLE_ORDER: MuscleEnum[] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'quads',
  'hamstrings_glutes',
  'calves',
  'core',
];

export default function SessionSummaryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();

  const { db, session: authSession } = useAuth();
  const userId = authSession?.user?.id ?? '';

  // ── Observable reads ──────────────────────────────────────────────────────
  const rawSessions = useRows(db?.workoutSessions$);
  const rawSessionExercises = useRows(db?.sessionExercises$);
  const rawSets = useRows(db?.sets$);
  const rawProfiles = useRows(db?.profiles$);
  const globalExercises = useRows(globalExercises$);
  const globalMuscles = useRows(globalExerciseMuscles$);
  const rawUserExercises = useRows(db?.userExercises$);
  const rawUserMuscles = useRows(db?.userExerciseMuscles$);

  const userUnit = useMemo(
    () => getUserUnitPreference(rawProfiles ?? {}, userId),
    [rawProfiles, userId],
  );

  // ── Merge catalogs ────────────────────────────────────────────────────────
  const allExercises: Record<string, ExerciseRow> = useMemo(
    () => ({ ...globalExercises, ...rawUserExercises }),
    [globalExercises, rawUserExercises],
  );

  const allMuscles = useMemo(
    () => ({ ...globalMuscles, ...rawUserMuscles }),
    [globalMuscles, rawUserMuscles],
  );

  // ── Derive session data ───────────────────────────────────────────────────
  const currentSession = useMemo(
    () => (rawSessions && sessionId ? (rawSessions[sessionId] ?? null) : null),
    [rawSessions, sessionId],
  );

  const sessionExercises = useMemo(
    () =>
      rawSessionExercises && sessionId
        ? getSessionExercises(rawSessionExercises, sessionId)
        : [],
    [rawSessionExercises, sessionId],
  );

  // Build musclesBySeId: session_exercise_id → muscle contributions
  const musclesBySeId: MusclesBySessionExerciseId = useMemo(() => {
    const map: MusclesBySessionExerciseId = {};
    for (const se of sessionExercises) {
      const exerciseMuscles = Object.values(allMuscles).filter(
        (m) => m.exercise_id === se.exercise_id,
      );
      // Key by session_exercise_id (as required by fractionalVolumeByMuscle)
      map[se.id] = exerciseMuscles.map((m) => ({
        muscle: m.muscle,
        contribution: m.contribution,
      }));
    }
    return map;
  }, [sessionExercises, allMuscles]);

  // summarizeSession expects sets keyed by session_exercise_id (via musclesBySeId)
  // but getSetsForSessionExercise gives the actual SetRow[] — we need to pass all
  // sets in a Record<string, SetRow> to summarizeSession.
  const summary = useMemo(() => {
    if (!currentSession || !rawSets || !rawSessionExercises || !rawSessions) return null;
    return summarizeSession(
      currentSession,
      rawSessionExercises,
      rawSets,
      rawSessions,
      musclesBySeId,
    );
  }, [currentSession, rawSets, rawSessionExercises, rawSessions, musclesBySeId]);

  // ── Build PR list ─────────────────────────────────────────────────────────
  const prSets = useMemo(() => {
    if (!summary || !rawSets) return [];
    return summary.prSetIds
      .map((id) => rawSets[id] ?? null)
      .filter(Boolean);
  }, [summary, rawSets]);

  const prItems = useMemo(() => {
    return prSets.map((set) => {
      const se = rawSessionExercises?.[set.session_exercise_id];
      const exercise = se ? allExercises[se.exercise_id] : null;
      const weightDisplay =
        set.weight_value != null
          ? `${set.weight_value} ${set.weight_unit ?? userUnit}`
          : set.weight_kg != null
          ? `${userUnit === 'lb' ? Math.round(kgToLb(set.weight_kg)) : set.weight_kg} ${userUnit}`
          : '—';
      return {
        id: set.id,
        exerciseName: exercise?.name ?? '—',
        weight: weightDisplay,
        reps: set.reps ?? 0,
      };
    });
  }, [prSets, rawSessionExercises, allExercises, userUnit]);

  // ── Tonnage (unit-aware) ──────────────────────────────────────────────────
  const tonnageDisplay = useMemo(() => {
    const kg = summary?.tonnageKg ?? 0;
    const value = userUnit === 'lb' ? Math.round(kgToLb(kg)) : Math.round(kg);
    return t('summary.tonnage_value', { value, unit: userUnit });
  }, [summary, userUnit, t]);

  // ── Header label ──────────────────────────────────────────────────────────
  const headerLabel = useMemo(() => {
    if (!currentSession) return '';
    const startDate = new Date(currentSession.started_at);
    const jsDay = startDate.getDay();
    const weekdayKey = jsDay === 0 ? '6' : String(jsDay - 1);
    const dayStr = t(`weekdays.${weekdayKey}`);
    return currentSession.name ? `${dayStr} · ${currentSession.name}` : dayStr;
  }, [currentSession, t]);

  // ── Duration ──────────────────────────────────────────────────────────────
  const durationDisplay = useMemo(
    () => formatDuration(summary?.durationMs, t),
    [summary, t],
  );

  // ── Guard states ──────────────────────────────────────────────────────────
  if (!db || rawSessions === null || rawSessionExercises === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!currentSession) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('session.not_found')}</Text>
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            style={styles.doneButton}
            accessibilityRole="button"
            accessibilityLabel={t('summary.done_button')}
          >
            <Text style={styles.doneButtonText}>{t('summary.done_button')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Muscles with any volume, sorted by MUSCLE_ORDER
  const muscleEntries = MUSCLE_ORDER.filter(
    (m) => (summary?.volumeByMuscle[m] ?? 0) > 0,
  ).map((m) => ({
    muscle: m,
    volume: Math.round((summary?.volumeByMuscle[m] ?? 0) * 2) / 2, // round to 0.5
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Success header ── */}
        <View style={styles.successSection}>
          <View style={styles.checkCircle} accessibilityRole="image" accessibilityLabel={t('summary.title')}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.successTitle}>{t('summary.title')}</Text>
          <Text style={styles.successSubtitle}>{headerLabel}</Text>
        </View>

        {/* ── Stats cards ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('summary.duration_label')}</Text>
            <Text style={styles.statValue}>{durationDisplay}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('summary.effective_sets_label')}</Text>
            <Text style={styles.statValue}>{summary?.effectiveSets ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('summary.tonnage_label')}</Text>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
              {tonnageDisplay}
            </Text>
          </View>
        </View>

        {/* ── Sets per muscle group ── */}
        <Text style={styles.sectionLabel}>{t('summary.sets_by_muscle')}</Text>
        {muscleEntries.length === 0 ? (
          <Text style={styles.emptyText}>{t('summary.empty_muscles')}</Text>
        ) : (
          <View style={styles.muscleList}>
            {muscleEntries.map(({ muscle, volume }) => (
              <View key={muscle} style={styles.muscleRow}>
                <Text style={styles.muscleLabel}>{t(`muscles.${muscle}`)}</Text>
                <Text style={styles.muscleValue}>{volume}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── PRs ── */}
        {prItems.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>{t('summary.prs_title')}</Text>
            <View style={styles.prCard}>
              {prItems.map((pr, idx) => (
                <View key={pr.id} style={[styles.prRow, idx > 0 && styles.prRowBorder]}>
                  <View style={styles.prIconWrapper}>
                    <Text style={styles.prIcon}>🏆</Text>
                  </View>
                  <View style={styles.prTextWrapper}>
                    <Text style={styles.prExercise}>{pr.exerciseName}</Text>
                    <Text style={styles.prDesc}>
                      {pr.weight} × {pr.reps}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* ── Done button ── */}
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={styles.doneButton}
          accessibilityRole="button"
          accessibilityLabel={t('summary.done_button')}
        >
          <Text style={styles.doneButtonText}>{t('summary.done_button')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { ...typography.body, color: colors.textSecondary },

  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    flexGrow: 1,
  },

  // Success header
  successSection: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
  checkCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: { fontSize: 28, color: colors.success },
  successTitle: { ...typography.title, color: colors.textPrimary, textAlign: 'center' },
  successSubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  statLabel: { ...typography.label, color: colors.textSecondary },
  statValue: { fontSize: 22, fontWeight: '500', color: colors.textPrimary },

  // Section label
  sectionLabel: { ...typography.label, color: colors.textTertiary, fontSize: 12 },

  // Muscle list
  muscleList: { gap: spacing.xs },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: TOUCH_TARGET,
  },
  muscleLabel: { ...typography.body, color: colors.textPrimary },
  muscleValue: { ...typography.section, color: colors.textPrimary },
  emptyText: { ...typography.body, color: colors.textTertiary },

  // PRs
  prCard: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  prRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.prBorder,
  },
  prIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.prIconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prIcon: { fontSize: 15 },
  prTextWrapper: { flex: 1 },
  prExercise: { ...typography.label, color: colors.warning, fontWeight: '600' },
  prDesc: { ...typography.label, color: colors.prText },

  // Done button
  doneButton: {
    minHeight: TOUCH_TARGET + 4,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  doneButtonText: { ...typography.section, color: colors.onAccent, fontSize: 15 },
});
