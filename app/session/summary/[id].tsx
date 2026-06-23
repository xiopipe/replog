/**
 * Session summary screen.
 *
 * Route: /session/summary/[id]  (Stack route)
 * Optional query param: ?edit=1  → pre-focus the duration editor (TKT-0030 stale-flow)
 *
 * Shown after finishing a session. Displays:
 *   - Success icon + day · routine name
 *   - Duration card (tappable/editable — TKT-0030) + Effective sets card
 *   - Exercises completed/planned chip (TKT-0029)
 *   - Sets per muscle group (fractional volume)
 *   - PRs achieved with type + delta + themed icon (TKT-0060)
 *   - Per-exercise time chip inline (TKT-0029)
 *   - "Hecho" button → navigate home
 *
 * Mirrors session-summary.svg wireframe exactly.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
import {
  countCompletedExercises,
  getExerciseDurationSeconds,
  formatExerciseTime,
  parseDurationInput,
  buildPRSummaryItems,
} from '@/lib/summaryHelpers';
import { updateSessionDuration } from '@/features/session/mutations';
import { formatWeight } from '@/features/session/weight-format';

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

// ---------------------------------------------------------------------------
// Duration editor modal (TKT-0030)
// ---------------------------------------------------------------------------

interface DurationEditorProps {
  visible: boolean;
  initialValue: string;
  autoFocus: boolean;
  onConfirm: (raw: string) => void;
  onClose: () => void;
}

function DurationEditorModal({
  visible,
  initialValue,
  autoFocus,
  onConfirm,
  onClose,
}: DurationEditorProps) {
  const { t } = useTranslation();
  // Remount key: when the modal opens, seed the input from initialValue via key.
  // React-19 rule: never set state synchronously in useEffect.
  const [raw, setRaw] = useState(initialValue);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const handleConfirm = useCallback(() => {
    const result = parseDurationInput(raw);
    if (result.errorKey) {
      setErrorKey(result.errorKey);
      return;
    }
    if (result.warn24h) {
      Alert.alert(
        t('summary.duration_edit_warn_24h'),
        undefined,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('summary.duration_edit_warn_confirm'),
            onPress: () => onConfirm(raw),
          },
        ],
      );
      return;
    }
    onConfirm(raw);
  }, [raw, t, onConfirm]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={edStyles.scrim}>
        <View style={edStyles.card} accessibilityViewIsModal>
          <Text style={edStyles.title}>{t('summary.duration_edit_title')}</Text>
          <TextInput
            key={visible ? 'open' : 'closed'}
            style={[edStyles.input, errorKey ? edStyles.inputError : undefined]}
            value={raw}
            onChangeText={(v) => {
              setRaw(v);
              if (errorKey) setErrorKey(null);
            }}
            keyboardType="numbers-and-punctuation"
            autoFocus={autoFocus}
            placeholder={t('summary.duration_edit_placeholder')}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={t('summary.duration_edit_title')}
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />
          {errorKey ? (
            <Text style={edStyles.errorText}>{t(errorKey)}</Text>
          ) : (
            <Text style={edStyles.hintText}>{t('summary.duration_edit_hint')}</Text>
          )}
          <View style={edStyles.buttons}>
            <Pressable
              style={edStyles.cancelBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={edStyles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              style={edStyles.confirmBtn}
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel={t('summary.duration_edit_confirm')}
            >
              <Text style={edStyles.confirmText}>{t('summary.duration_edit_confirm')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const edStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { ...typography.section, color: colors.textPrimary, fontSize: 17 },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    minHeight: TOUCH_TARGET,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  inputError: { borderColor: colors.error },
  errorText: { ...typography.label, color: colors.error },
  hintText: { ...typography.label, color: colors.textTertiary },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  cancelBtn: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { ...typography.label, color: colors.textSecondary, fontWeight: '500' },
  confirmBtn: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { ...typography.label, color: colors.onAccent, fontWeight: '600' },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function SessionSummaryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id: sessionId, edit } = useLocalSearchParams<{ id: string; edit?: string }>();

  // TKT-0030: pre-focus when arriving from stale-finish flow
  const prefocusDuration = edit === '1';

  const { db, session: authSession } = useAuth();
  const userId = authSession?.user?.id ?? '';

  // TKT-0030: duration editor state
  const [durationEditorOpen, setDurationEditorOpen] = useState(prefocusDuration);
  const [durationEditorAutoFocus, setDurationEditorAutoFocus] = useState(prefocusDuration);

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
      map[se.id] = exerciseMuscles.map((m) => ({
        muscle: m.muscle,
        contribution: m.contribution,
      }));
    }
    return map;
  }, [sessionExercises, allMuscles]);

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

  // ── TKT-0060: Rich PR list ────────────────────────────────────────────────
  const prSummaryItems = useMemo(() => {
    if (!summary || !rawSets || !rawSessionExercises || !sessionId) return [];
    return buildPRSummaryItems(
      summary.prSetIds,
      rawSets,
      rawSessionExercises,
      allExercises,
      sessionId,
      userUnit,
      kgToLb,
      formatWeight,
    );
  }, [summary, rawSets, rawSessionExercises, allExercises, sessionId, userUnit]);

  // ── TKT-0029: Exercises completed/planned ────────────────────────────────
  const exercisesCompletedDisplay = useMemo(() => {
    if (!rawSets || sessionExercises.length === 0) return null;
    const completed = countCompletedExercises(sessionExercises, rawSets);
    if (currentSession?.routine_id) {
      return t('summary.exercises_completed_planned', {
        completed,
        planned: sessionExercises.length,
      });
    }
    return t('summary.exercises_completed', { count: completed });
  }, [rawSets, sessionExercises, currentSession, t]);

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

  // Initial value for duration editor input (in minutes for simplicity)
  const durationEditorInitial = useMemo(() => {
    if (summary?.durationMs == null || summary.durationMs <= 0) return '';
    const totalMin = Math.round(summary.durationMs / 60000);
    return String(totalMin);
  }, [summary]);

  // ── TKT-0030: Confirm duration edit ──────────────────────────────────────
  const handleDurationConfirm = useCallback(
    (raw: string) => {
      const result = parseDurationInput(raw);
      if (!result.seconds || !db || !sessionId) return;
      updateSessionDuration(db, sessionId, result.seconds);
      setDurationEditorOpen(false);
    },
    [db, sessionId],
  );

  const handleOpenDurationEditor = useCallback(() => {
    setDurationEditorAutoFocus(true);
    setDurationEditorOpen(true);
  }, []);

  const handleCloseDurationEditor = useCallback(() => {
    setDurationEditorOpen(false);
  }, []);

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
      {/* TKT-0030: Duration editor modal */}
      <DurationEditorModal
        key={durationEditorOpen ? 'open' : 'closed'}
        visible={durationEditorOpen}
        initialValue={durationEditorInitial}
        autoFocus={durationEditorAutoFocus}
        onConfirm={handleDurationConfirm}
        onClose={handleCloseDurationEditor}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Success header ── */}
        <View style={styles.successSection}>
          <View style={styles.checkCircle} accessibilityRole="image" accessibilityLabel={t('summary.title')}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.successTitle}>{t('summary.title')}</Text>
          <Text style={styles.successSubtitle} numberOfLines={1} ellipsizeMode="tail">
            {headerLabel}
          </Text>
        </View>

        {/* ── Stats cards ── */}
        <View style={styles.statsRow}>
          {/* TKT-0030: Duration card is tappable */}
          <Pressable
            style={styles.statCard}
            onPress={handleOpenDurationEditor}
            accessibilityRole="button"
            accessibilityLabel={t('summary.duration_tap_hint')}
            accessibilityHint={t('summary.duration_tap_hint')}
          >
            <Text style={styles.statLabel}>{t('summary.duration_label')}</Text>
            <Text style={styles.statValue}>{durationDisplay}</Text>
            <View style={styles.editChip}>
              <MaterialCommunityIcons name="pencil-outline" size={10} color={colors.textTertiary} />
            </View>
          </Pressable>
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

        {/* ── TKT-0029: Exercises completed chip ── */}
        {exercisesCompletedDisplay ? (
          <View style={styles.exercisesChip}>
            <Text style={styles.exercisesChipText}>{exercisesCompletedDisplay}</Text>
          </View>
        ) : null}

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

        {/* ── TKT-0029: Exercise list with per-exercise time chips ── */}
        {sessionExercises.length > 0 && rawSets ? (
          <View style={styles.exerciseTimeList}>
            {sessionExercises.map((se) => {
              const exercise = allExercises[se.exercise_id];
              const durationSec = getExerciseDurationSeconds(se);
              const timeChip = formatExerciseTime(durationSec, t);
              const exSets = Object.values(rawSets).filter(
                (s) => s.session_exercise_id === se.id && !s.deleted_at && !s.is_warmup,
              );
              if (exSets.length === 0) return null; // only list exercises with working sets
              return (
                <View key={se.id} style={styles.exerciseTimeRow}>
                  <Text style={styles.exerciseTimeName} numberOfLines={1} ellipsizeMode="tail">
                    {exercise?.name ?? '—'}
                  </Text>
                  {timeChip ? (
                    <View style={styles.timeChip}>
                      <Text style={styles.timeChipText}>{timeChip}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* ── TKT-0060: Rich PRs ── */}
        {prSummaryItems.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>{t('summary.prs_title')}</Text>
            <View style={styles.prCard}>
              {prSummaryItems.map((pr, idx) => {
                const prLabel =
                  pr.prType === '1rm'
                    ? t('summary.pr_label_1rm')
                    : t('summary.pr_label_rep');

                const deltaLabel =
                  pr.delta != null && pr.delta > 0
                    ? pr.prType === '1rm'
                      ? t('summary.pr_delta_1rm', { delta: pr.delta.toFixed(1), unit: userUnit })
                      : t('summary.pr_delta_rep', { count: pr.delta })
                    : null;

                return (
                  <View
                    key={pr.setId}
                    style={[styles.prRow, idx > 0 && styles.prRowBorder]}
                    accessible
                    accessibilityLabel={t('summary.pr_a11y', {
                      prLabel,
                      exercise: pr.exerciseName,
                    })}
                  >
                    <View style={styles.prIconWrapper}>
                      {/* TKT-0060: themed MaterialCommunityIcons trophy — no raw emoji */}
                      <MaterialCommunityIcons
                        name="trophy"
                        size={16}
                        color={colors.warning}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                      />
                    </View>
                    <View style={styles.prTextWrapper}>
                      {/* PR type label */}
                      <Text style={styles.prTypeLabel}>{prLabel}</Text>
                      {/* Exercise name — KI-010: numberOfLines={1} */}
                      <Text style={styles.prExercise} numberOfLines={1} ellipsizeMode="tail">
                        {pr.exerciseName}
                      </Text>
                      {/* Delta */}
                      {deltaLabel ? (
                        <Text style={styles.prDelta}>{deltaLabel}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
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
  // TKT-0030: small edit affordance on the duration card
  editChip: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },

  // TKT-0029: Exercises completed chip
  exercisesChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  exercisesChipText: { ...typography.label, color: colors.textSecondary },

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

  // TKT-0029: Exercise time list
  exerciseTimeList: { gap: spacing.xs },
  exerciseTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: TOUCH_TARGET,
  },
  exerciseTimeName: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  timeChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  timeChipText: { ...typography.label, color: colors.textSecondary },

  // TKT-0060: PRs
  prCard: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 2,
  },
  prTextWrapper: { flex: 1 },
  prTypeLabel: {
    ...typography.label,
    color: colors.warning,
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  prExercise: {
    ...typography.label,
    color: colors.warning,
    fontWeight: '500',
    marginTop: 1,
  },
  prDelta: {
    ...typography.label,
    color: colors.prText,
    marginTop: 1,
  },

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
