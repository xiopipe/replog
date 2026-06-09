/**
 * Active session screen — the focused workout walkthrough.
 *
 * Route: /session/[id]  (Stack route; tab bar is hidden — no (tabs) group)
 *
 * One exercise at a time. Progress dots. Session timer + per-exercise timer.
 * Inline set rows. ⋮ menu for add/swap/skip/superset/dropset.
 * PR micro-celebration on confirming a working set.
 * "Siguiente ejercicio →" or "Finalizar" primary action.
 */

import { use$ } from '@legendapp/state/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionSheetIOS,
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

import { globalExercises$ } from '@/db';
import type { ExerciseRow, FailureMetricEnum, SetRow as SetRowData, UnitEnum } from '@/db';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';

import {
  getSessionExercises,
  getSetsForSessionExercise,
  getExerciseHistorySets,
  detectPR,
  getUserUnitPreference,
  getUserDefaultFailureMetric,
} from '@/features/session/queries';
import { toCanonicalKg } from '@/lib/hypertrophy';
import {
  addSet,
  duplicateSet,
  updateSet,
  deleteSet,
  goToNextExercise,
  skipExercise,
  groupAsSuperset,
  groupSetsAsDropset,
  finishSession,
} from '@/features/session/mutations';

import { SessionTimer } from '@/features/session/SessionTimer';
import { ExercisePager } from '@/features/session/ExercisePager';
import { SetRow } from '@/features/session/SetRow';
import { PRBadge } from '@/features/session/PRBadge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PRInfo {
  exerciseName: string;
  weight: string;
  reps: number;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ActiveSessionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();

  const { db, session } = useAuth();
  const userId = session?.user?.id ?? '';

  // ── Observable reads ──────────────────────────────────────────────────────
  const rawSessions = use$(db?.workoutSessions$);
  const rawSessionExercises = use$(db?.sessionExercises$);
  const rawSets = use$(db?.sets$);
  const rawProfiles = use$(db?.profiles$);
  const globalExercises = use$(globalExercises$);
  const rawUserExercises = use$(db?.userExercises$);

  // ── Current exercise index (local) ────────────────────────────────────────
  const [exerciseIndex, setExerciseIndex] = useState(0);

  // ── PR celebration state ──────────────────────────────────────────────────
  const [prInfo, setPrInfo] = useState<PRInfo | null>(null);

  // ── PR badge dismiss ──────────────────────────────────────────────────────
  const handleDismissPR = useCallback(() => setPrInfo(null), []);

  // ── Dropset selection mode ────────────────────────────────────────────────
  const [dropsetSelection, setDropsetSelection] = useState<Set<string>>(new Set());
  const [isSelectingDropset, setIsSelectingDropset] = useState(false);

  // ── Derive data ───────────────────────────────────────────────────────────
  const currentSession = useMemo(
    () => (rawSessions && sessionId ? (rawSessions[sessionId] ?? null) : null),
    [rawSessions, sessionId],
  );

  const sessionExercises = useMemo(
    () => (rawSessionExercises && sessionId ? getSessionExercises(rawSessionExercises, sessionId) : []),
    [rawSessionExercises, sessionId],
  );

  // Keep index clamped when exercises change
  const safeIndex = Math.min(exerciseIndex, Math.max(0, sessionExercises.length - 1));
  const currentSE = sessionExercises[safeIndex] ?? null;

  const currentSets = useMemo(
    () => (rawSets && currentSE ? getSetsForSessionExercise(rawSets, currentSE.id) : []),
    [rawSets, currentSE],
  );

  // Merge exercise catalogs
  const allExercises: Record<string, ExerciseRow> = useMemo(
    () => ({ ...globalExercises, ...rawUserExercises }),
    [globalExercises, rawUserExercises],
  );

  const currentExercise = currentSE ? (allExercises[currentSE.exercise_id] ?? null) : null;

  // Profile preferences
  const userUnit: UnitEnum = useMemo(
    () => getUserUnitPreference(rawProfiles ?? {}, userId),
    [rawProfiles, userId],
  );
  const defaultFailureMetric: FailureMetricEnum = useMemo(
    () => getUserDefaultFailureMetric(rawProfiles ?? {}, userId),
    [rawProfiles, userId],
  );

  // ── Confirm set with PR detection ─────────────────────────────────────────
  const handleConfirmSet = useCallback(
    (setId: string, patch: Partial<SetRowData>, exerciseId: string) => {
      if (!db) return;

      updateSet(db, setId, patch);

      // Build the merged candidate with locally computed weight_kg so PR
      // detection never reads the stale snapshot (which may still be null).
      const existing = rawSets?.[setId] ?? ({} as Partial<SetRowData>);
      const mergedWeightValue = 'weight_value' in patch ? patch.weight_value : existing.weight_value;
      const mergedWeightUnit = 'weight_unit' in patch ? patch.weight_unit : existing.weight_unit;
      const computedWeightKg =
        mergedWeightValue != null && mergedWeightUnit != null
          ? toCanonicalKg(mergedWeightValue, mergedWeightUnit as 'kg' | 'lb')
          : (existing.weight_kg ?? null);

      // Reflect current is_warmup: patch wins, else read latest snapshot
      const currentIsWarmup =
        patch.is_warmup !== undefined ? patch.is_warmup : (rawSets?.[setId]?.is_warmup ?? false);

      const updatedSet = {
        ...existing,
        ...patch,
        weight_kg: computedWeightKg,
        is_warmup: currentIsWarmup,
      } as SetRowData;

      // PR detection — only for working sets
      if (!updatedSet.is_warmup && updatedSet.reps && updatedSet.weight_kg != null) {
        const history = getExerciseHistorySets(
          rawSets ?? {},
          rawSessionExercises ?? {},
          exerciseId,
          { excludeSessionId: sessionId },
        );
        const { is1RM, isRepPR } = detectPR(updatedSet, history);
        if (is1RM || isRepPR) {
          const weightDisplay =
            updatedSet.weight_value != null
              ? `${updatedSet.weight_value} ${updatedSet.weight_unit ?? userUnit}`
              : `${updatedSet.weight_kg} kg`;
          setPrInfo({
            exerciseName: currentExercise?.name ?? '',
            weight: weightDisplay,
            reps: updatedSet.reps,
          });
        }
      }
    },
    [db, rawSets, rawSessionExercises, sessionId, userUnit, currentExercise],
  );

  // ── Add set ───────────────────────────────────────────────────────────────
  const handleAddSet = useCallback(() => {
    if (!db || !currentSE) return;

    // Prefill from the last set
    const lastSet = currentSets[currentSets.length - 1];
    addSet(db, currentSE.id, {
      userId,
      weight_value: lastSet?.weight_value ?? null,
      weight_unit: lastSet?.weight_unit ?? userUnit,
      reps: lastSet?.reps ?? null,
      failure_metric: lastSet?.failure_metric ?? defaultFailureMetric,
      rir: lastSet?.rir ?? null,
      rpe: lastSet?.rpe ?? null,
      is_warmup: false,
    });
  }, [db, currentSE, currentSets, userId, userUnit, defaultFailureMetric]);

  // ── Add warmup set ────────────────────────────────────────────────────────
  const handleAddWarmupSet = useCallback(() => {
    if (!db || !currentSE) return;

    const lastWarmup = [...currentSets].reverse().find((s) => s.is_warmup);
    addSet(db, currentSE.id, {
      userId,
      weight_value: lastWarmup?.weight_value ?? null,
      weight_unit: lastWarmup?.weight_unit ?? userUnit,
      reps: lastWarmup?.reps ?? null,
      failure_metric: 'none',
      rir: null,
      rpe: null,
      is_warmup: true,
    });
  }, [db, currentSE, currentSets, userId, userUnit]);

  // ── Duplicate last set ────────────────────────────────────────────────────
  const handleDuplicateSet = useCallback(() => {
    if (!db || !currentSE) return;
    const lastSet = currentSets[currentSets.length - 1];
    if (!lastSet) {
      handleAddSet();
      return;
    }
    duplicateSet(db, lastSet);
  }, [db, currentSE, currentSets, handleAddSet]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleNextExercise = useCallback(() => {
    if (!db || !currentSE || !sessionId) return;

    const nextIndex = safeIndex + 1;
    const nextSE = sessionExercises[nextIndex] ?? null;

    goToNextExercise(db, sessionId, currentSE.id, nextSE?.id ?? null);

    if (nextSE) {
      setExerciseIndex(nextIndex);
    } else {
      // Last exercise → finish session
      finishSession(db, sessionId);
      router.replace(`/session/summary/${sessionId}`);
    }
  }, [db, currentSE, sessionId, safeIndex, sessionExercises, router]);

  const handleFinishWorkout = useCallback(() => {
    if (!db || !sessionId) return;
    if (currentSE) {
      goToNextExercise(db, sessionId, currentSE.id, null);
    }
    finishSession(db, sessionId);
    router.replace(`/session/summary/${sessionId}`);
  }, [db, sessionId, currentSE, router]);

  // ── ⋮ Menu ────────────────────────────────────────────────────────────────

  // handleMenuAction is defined first so showMenu can reference it directly.
  const handleMenuAction = useCallback(
    (actionIndex: number) => {
      if (!db || !sessionId || !currentSE) return;

      switch (actionIndex) {
        case 0: // Add exercise
          router.push(`/catalog?pickForSession=${sessionId}`);
          break;
        case 1: // Swap exercise
          router.push(`/catalog?swapSession=${sessionId}&swapSE=${currentSE.id}`);
          break;
        case 2: // Skip exercise
          Alert.alert(t('session.skip_confirm'), undefined, [
            {
              text: t('session.skip_yes'),
              style: 'destructive',
              onPress: () => {
                skipExercise(db, currentSE.id);
                const nextIndex = Math.min(safeIndex, sessionExercises.length - 2);
                setExerciseIndex(Math.max(0, nextIndex));
              },
            },
            { text: t('common.cancel'), style: 'cancel' },
          ]);
          break;
        case 3: // Group superset with adjacent
          {
            const adjacentSE = sessionExercises[safeIndex + 1] ?? sessionExercises[safeIndex - 1];
            if (adjacentSE) {
              groupAsSuperset(db, [currentSE.id, adjacentSE.id]);
            }
          }
          break;
        case 4: // Start dropset selection
          setIsSelectingDropset(true);
          setDropsetSelection(new Set());
          break;
        default:
          break;
      }
    },
    [db, sessionId, currentSE, safeIndex, sessionExercises, router, t],
  );

  const showMenu = useCallback(() => {
    const options = [
      t('session.menu_add_exercise'),
      t('session.menu_swap_exercise'),
      t('session.menu_skip_exercise'),
      t('session.menu_group_superset'),
      t('session.menu_group_dropset'),
      t('common.cancel'),
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1 },
        (idx) => handleMenuAction(idx),
      );
    } else {
      // Android: Alert-based menu
      Alert.alert(t('session.exercise_menu_title'), undefined, [
        {
          text: t('session.menu_add_exercise'),
          onPress: () => handleMenuAction(0),
        },
        {
          text: t('session.menu_swap_exercise'),
          onPress: () => handleMenuAction(1),
        },
        {
          text: t('session.menu_skip_exercise'),
          style: 'destructive',
          onPress: () => handleMenuAction(2),
        },
        {
          text: t('session.menu_group_superset'),
          onPress: () => handleMenuAction(3),
        },
        {
          text: t('session.menu_group_dropset'),
          onPress: () => handleMenuAction(4),
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    }
  }, [t, handleMenuAction]);

  const handleConfirmDropset = useCallback(() => {
    if (!db || dropsetSelection.size < 2) {
      setIsSelectingDropset(false);
      return;
    }
    groupSetsAsDropset(db, Array.from(dropsetSelection));
    setIsSelectingDropset(false);
    setDropsetSelection(new Set());
  }, [db, dropsetSelection]);

  const toggleSetSelection = useCallback((setId: string) => {
    setDropsetSelection((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) {
        next.delete(setId);
      } else {
        next.add(setId);
      }
      return next;
    });
  }, []);

  // ── Day/routine label for header ──────────────────────────────────────────
  const headerLabel = useMemo(() => {
    if (!currentSession) return '';
    const startDate = new Date(currentSession.started_at);
    const jsDay = startDate.getDay();
    const weekdayKey = jsDay === 0 ? '6' : String(jsDay - 1);
    const dayStr = t(`weekdays.${weekdayKey}`);
    return currentSession.name ? `${dayStr} · ${currentSession.name}` : dayStr;
  }, [currentSession, t]);

  // ── Guard states ──────────────────────────────────────────────────────────
  if (!db || rawSessions === null || rawSessionExercises === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>{t('session.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentSession) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('session.not_found')}</Text>
          <Pressable onPress={() => router.back()} style={styles.backPressable}>
            <Text style={styles.backText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isLastExercise = safeIndex >= sessionExercises.length - 1;
  const isFinishedSession = currentSession.status === 'completed';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      {/* PR Badge (absolute overlay) */}
      {prInfo ? (
        <PRBadge
          exerciseName={prInfo.exerciseName}
          weight={prInfo.weight}
          reps={prInfo.reps}
          onDismiss={handleDismissPR}
        />
      ) : null}

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLabel} numberOfLines={1}>
            {headerLabel}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Ionicons name="timer-outline" size={14} color={colors.textSecondary} />
          <SessionTimer
            startedAt={currentSession.started_at}
            style={styles.sessionTimerText}
            accessibilityLabel={t('session.session_timer_label')}
          />
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── Progress row ── */}
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {sessionExercises.length > 0
            ? t('session.exercise_progress', {
                current: safeIndex + 1,
                total: sessionExercises.length,
              })
            : ''}
        </Text>
        {!isFinishedSession && (
          <Pressable
            onPress={showMenu}
            style={styles.menuButton}
            accessibilityRole="button"
            accessibilityLabel={t('session.exercise_menu_title')}
            hitSlop={8}
          >
            <Text style={styles.menuIcon}>⋮</Text>
          </Pressable>
        )}
      </View>

      {/* ── Exercise name + per-exercise timer ── */}
      {currentExercise ? (
        <View style={styles.exerciseHeader}>
          <Text style={styles.exerciseName} numberOfLines={2}>
            {currentExercise.name}
          </Text>
          {currentSE?.started_at ? (
            <View style={styles.exerciseTimerChip}>
              <Text style={styles.exerciseTimerChipText}>
                {t('session.on_this_exercise')}
              </Text>
              <SessionTimer
                startedAt={currentSE.started_at}
                style={styles.exerciseTimerInline}
                accessibilityLabel={t('session.exercise_timer_label')}
              />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.exerciseHeader}>
          <Text style={styles.noExercisesText}>{t('session.no_exercises')}</Text>
        </View>
      )}

      {/* ── Column headers ── */}
      {currentExercise ? (
        <View style={styles.colHeaders}>
          <Text style={[styles.colHeader, styles.colHeaderIndex]}>{t('session.set_number')}</Text>
          <Text style={[styles.colHeader, styles.colHeaderWide]}>
            {currentExercise.is_bodyweight ? t('session.added_load_label') : t('session.weight_label')}
          </Text>
          <Text style={[styles.colHeader, styles.colHeaderWide]}>{t('session.reps_label')}</Text>
          {defaultFailureMetric !== 'none' ? (
            <Text style={[styles.colHeader, styles.colHeaderNarrow]}>
              {defaultFailureMetric === 'rpe' ? t('session.rpe_label') : t('session.rir_label')}
            </Text>
          ) : (
            <View style={styles.colHeaderNarrow} />
          )}
          <View style={styles.colHeaderConfirm} />
        </View>
      ) : null}

      {/* ── Sets list ── */}
      <ScrollView
        style={styles.setsScrollView}
        contentContainerStyle={styles.setsContent}
        keyboardShouldPersistTaps="handled"
      >
        {currentSets.map((set, idx) => (
          <SetRow
            key={set.id}
            set={set}
            index={idx}
            isBodyweight={currentExercise?.is_bodyweight ?? false}
            defaultFailureMetric={defaultFailureMetric}
            userUnit={userUnit}
            isSelected={dropsetSelection.has(set.id)}
            onConfirm={(patch) =>
              handleConfirmSet(set.id, patch, currentExercise?.id ?? currentSE?.exercise_id ?? '')
            }
            onDelete={() => deleteSet(db, set.id)}
            onSelectionToggle={isSelectingDropset ? () => toggleSetSelection(set.id) : undefined}
            onToggleWarmup={() => updateSet(db, set.id, { is_warmup: !set.is_warmup })}
          />
        ))}

        {/* Dropset action bar */}
        {isSelectingDropset ? (
          <View style={styles.dropsetBar}>
            <Text style={styles.dropsetBarText}>{t('session.select_sets_for_dropset')}</Text>
            <Pressable
              onPress={handleConfirmDropset}
              style={styles.dropsetConfirmBtn}
              accessibilityRole="button"
              accessibilityLabel={t('session.dropset_done')}
            >
              <Text style={styles.dropsetConfirmText}>{t('session.dropset_done')}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Add / Duplicate / Warmup buttons ── */}
        {!isFinishedSession && currentExercise ? (
          <View style={styles.setActions}>
            <Pressable
              onPress={handleAddSet}
              style={styles.setActionButton}
              accessibilityRole="button"
              accessibilityLabel={t('session.add_set')}
            >
              <Text style={styles.setActionText}>{t('session.add_set')}</Text>
            </Pressable>
            <Pressable
              onPress={handleDuplicateSet}
              style={styles.setActionButton}
              accessibilityRole="button"
              accessibilityLabel={t('session.duplicate_set')}
            >
              <Text style={styles.setActionText}>{t('session.duplicate_set')}</Text>
            </Pressable>
            <Pressable
              onPress={handleAddWarmupSet}
              style={styles.setActionButton}
              accessibilityRole="button"
              accessibilityLabel={t('session.add_warmup_set')}
            >
              <Text style={styles.setActionText}>{t('session.add_warmup_set')}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Position dots ── */}
      <ExercisePager
        total={sessionExercises.length}
        currentIndex={safeIndex}
        onSelect={(i) => setExerciseIndex(i)}
      />

      {/* ── Bottom actions ── */}
      {!isFinishedSession ? (
        <View style={styles.bottomActions}>
          <Pressable
            onPress={handleNextExercise}
            style={styles.nextButton}
            accessibilityRole="button"
            accessibilityLabel={
              isLastExercise ? t('session.finish_workout') : t('session.next_exercise')
            }
          >
            <Text style={styles.nextButtonText}>
              {isLastExercise ? t('session.finish_workout') : t('session.next_exercise')}
            </Text>
          </Pressable>
          {!isLastExercise ? (
            <Pressable
              onPress={handleFinishWorkout}
              style={styles.finishLink}
              accessibilityRole="button"
              accessibilityLabel={t('session.finish_workout')}
            >
              <Text style={styles.finishLinkText}>{t('session.finish_workout')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.bottomActions}>
          <Pressable
            onPress={() => router.replace(`/session/summary/${sessionId}`)}
            style={styles.nextButton}
            accessibilityRole="button"
            accessibilityLabel={t('summary.done_button')}
          >
            <Text style={styles.nextButtonText}>{t('summary.done_button')}</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { ...typography.body, color: colors.textSecondary },
  errorText: { ...typography.body, color: colors.textSecondary },
  backPressable: { minHeight: TOUCH_TARGET, justifyContent: 'center' },
  backText: { ...typography.body, color: colors.accent },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerLabel: { ...typography.label, color: colors.textSecondary, fontSize: 12 },
  sessionTimerText: { ...typography.label, color: colors.textSecondary, fontSize: 12 },

  divider: { height: 1, backgroundColor: colors.border },

  // Progress row
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  progressText: { ...typography.label, color: colors.textTertiary, fontSize: 11 },
  menuButton: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { fontSize: 18, color: colors.textSecondary, fontWeight: '700' },

  // Exercise name + timer
  exerciseHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  exerciseName: { ...typography.section, color: colors.textPrimary, fontSize: 17 },
  exerciseTimerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
    gap: 4,
  },
  exerciseTimerChipText: { ...typography.label, color: colors.accent, fontSize: 12 },
  exerciseTimerInline: { ...typography.label, color: colors.accent, fontSize: 12 },
  noExercisesText: { ...typography.body, color: colors.textTertiary },

  // Column headers
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  colHeader: { ...typography.label, color: colors.textTertiary, fontSize: 11 },
  colHeaderIndex: { width: 24, textAlign: 'center' },
  colHeaderWide: { flex: 3 },
  colHeaderNarrow: { flex: 2 },
  colHeaderConfirm: { width: TOUCH_TARGET },

  // Sets
  setsScrollView: { flex: 1 },
  setsContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
    flexGrow: 1,
  },

  // Set action buttons
  setActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  setActionButton: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  setActionText: { ...typography.label, color: colors.textPrimary, fontWeight: '500' },

  // Dropset bar
  dropsetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
  },
  dropsetBarText: { flex: 1, ...typography.label, color: colors.textSecondary },
  dropsetConfirmBtn: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropsetConfirmText: { ...typography.label, color: colors.onAccent, fontWeight: '600' },

  // Position dots
  pager: { paddingVertical: spacing.sm },

  // Bottom actions
  bottomActions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  nextButton: {
    minHeight: TOUCH_TARGET + 4,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: { ...typography.section, color: colors.onAccent, fontSize: 15 },
  finishLink: {
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishLinkText: { ...typography.label, color: colors.textSecondary, fontSize: 12 },
});
