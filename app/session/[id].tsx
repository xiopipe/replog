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

import { useRows, softDelete } from '@/db';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { globalExercises$ } from '@/db';
import type { ExerciseRow, FailureMetricEnum, SetRow as SetRowData, UnitEnum } from '@/db';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';

import {
  getSessionExercises,
  getSetsForSessionExercise,
  getExerciseHistorySets,
  getLastSetsForExercise,
  detectPR,
  getUserUnitPreference,
  getUserDefaultFailureMetric,
} from '@/features/session/queries';
import { toCanonicalKg, estimated1RM, kgToLb } from '@/lib/hypertrophy';
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
  setActiveTime,
} from '@/features/session/mutations';
import { isSessionStale } from '@/features/session/activeTime';
import { useActiveSessionTimer } from '@/features/session/useActiveSessionTimer';

import { ActionMenu } from '@/components/ActionMenu';
// SessionTimer = per-exercise timer (wall-clock time-on-current-exercise, kept
// intentionally — see TKT-0011 out-of-scope). formatMmSs renders the session
// timer, which now uses real active time (displaySeconds), not wall-clock.
import { SessionTimer, formatMmSs } from '@/features/session/SessionTimer';
import { StaleSessionModal } from '@/features/session/StaleSessionModal';
import { ExercisePager } from '@/features/session/ExercisePager';
import { SetRow } from '@/features/session/SetRow';
import { formatWeight } from '@/features/session/weight-format';
import { PRBadge, type PRType } from '@/features/session/PRBadge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PRInfo {
  exerciseName: string;
  weight: string;
  reps: number;
  prType: PRType;
  /** e1RM delta in the user's display unit (may be null for first-ever set). */
  delta: number | null;
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
  const rawSessions = useRows(db?.workoutSessions$);
  const rawSessionExercises = useRows(db?.sessionExercises$);
  const rawSets = useRows(db?.sets$);
  const rawProfiles = useRows(db?.profiles$);
  const globalExercises = useRows(globalExercises$);
  const rawUserExercises = useRows(db?.userExercises$);

  // ── Current exercise index (local) ────────────────────────────────────────
  const [exerciseIndex, setExerciseIndex] = useState(0);

  // ── PR celebration state ──────────────────────────────────────────────────
  const [prInfo, setPrInfo] = useState<PRInfo | null>(null);

  // ── PR badge dismiss ──────────────────────────────────────────────────────
  const handleDismissPR = useCallback(() => setPrInfo(null), []);

  // ── Dropset selection mode ────────────────────────────────────────────────
  const [dropsetSelection, setDropsetSelection] = useState<Set<string>>(new Set());
  const [isSelectingDropset, setIsSelectingDropset] = useState(false);

  // ── Exercise action menu ──────────────────────────────────────────────────
  const [menuVisible, setMenuVisible] = useState(false);

  // ── Derive data ───────────────────────────────────────────────────────────
  const currentSession = useMemo(
    () => (rawSessions && sessionId ? (rawSessions[sessionId] ?? null) : null),
    [rawSessions, sessionId],
  );

  // ── TKT-0011: real active-time session timer (excludes backgrounded time) ──
  const sessionIsActive = currentSession?.status === 'in_progress';
  const { displaySeconds, commitNow } = useActiveSessionTimer({
    db,
    sessionId: sessionId ?? null,
    accumulatedSeconds: currentSession?.accumulated_active_seconds ?? 0,
    isActive: sessionIsActive,
  });

  // ── TKT-0011: stale-session recovery prompt (reopened after a long gap) ────
  // Derived (no setState-in-effect): capture "now" once at mount, then show the
  // prompt while it is detected and not yet dismissed.
  const [mountNow] = useState(() => Date.now());
  const [staleDismissed, setStaleDismissed] = useState(false);
  const staleModalVisible =
    !staleDismissed &&
    !!currentSession &&
    currentSession.status === 'in_progress' &&
    isSessionStale(currentSession.updated_at, mountNow);

  const handleStaleContinue = useCallback(() => {
    setStaleDismissed(true);
  }, []);

  const handleStaleFinishWithDuration = useCallback(
    (seconds: number) => {
      setStaleDismissed(true);
      if (!db || !sessionId) return;
      commitNow(); // stop the in-flight segment so unmount does not re-add time
      // The user's entry is authoritative — even "0 min". Clamp to >= 1s so
      // accumulated_active_seconds stays > 0 and the summary never falls back to
      // the wall-clock (started_at→ended_at) duration we are trying to override.
      setActiveTime(db, sessionId, Math.max(1, Math.floor(seconds)));
      finishSession(db, sessionId);
      router.replace(`/session/summary/${sessionId}`);
    },
    [db, sessionId, commitNow, router],
  );

  const handleStaleDiscard = useCallback(() => {
    setStaleDismissed(true);
    if (!db || !sessionId) return;
    softDelete(db.workoutSessions$, sessionId);
    router.replace('/(tabs)');
  }, [db, sessionId, router]);

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

  // ── TKT-0014: Last session sets for the current exercise (prefill + "last time" line) ─────────
  const lastSessionSets = useMemo(() => {
    if (!rawSets || !rawSessionExercises || !rawSessions || !currentSE) return [];
    return getLastSetsForExercise(
      rawSets,
      rawSessionExercises,
      rawSessions,
      currentSE.exercise_id,
      { excludeSessionId: sessionId ?? undefined },
    );
  }, [rawSets, rawSessionExercises, rawSessions, currentSE, sessionId]);

  // The first working set from the last session is the prefill reference.
  const lastSessionFirstSet = lastSessionSets[0] ?? null;

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
          const weightDisplay = formatWeight(updatedSet, userUnit);

          // TKT-0027: Determine which PR type to display (prefer 1RM).
          const resolvedPrType: PRType = is1RM ? '1rm' : 'rep';

          // Compute e1RM delta for 1RM PRs
          let delta: number | null = null;
          if (is1RM && updatedSet.weight_kg != null && updatedSet.reps) {
            const currentE1RM = estimated1RM(updatedSet.weight_kg, updatedSet.reps);
            const workingHistory = history.filter(
              (s) => !s.is_warmup && !s.deleted_at && s.weight_kg != null && s.reps != null && s.reps >= 1,
            );
            if (workingHistory.length > 0) {
              const prevBest = Math.max(
                ...workingHistory.map((s) => estimated1RM(s.weight_kg!, s.reps!)),
              );
              const deltaKg = currentE1RM - prevBest;
              delta = userUnit === 'lb' ? kgToLb(deltaKg) : deltaKg;
            }
          }

          setPrInfo({
            exerciseName: currentExercise?.name ?? '',
            weight: weightDisplay,
            reps: updatedSet.reps,
            prType: resolvedPrType,
            delta,
          });
        }
      }
    },
    [db, rawSets, rawSessionExercises, sessionId, userUnit, currentExercise],
  );

  // ── Add set ───────────────────────────────────────────────────────────────
  const handleAddSet = useCallback(() => {
    if (!db || !currentSE) return;

    const lastSet = currentSets[currentSets.length - 1];

    // TKT-0014: If this exercise has no sets yet in the current session,
    // prefill from the last completed session instead of an empty set.
    const workingSetsInSession = currentSets.filter((s) => !s.is_warmup);
    const prefillSource =
      workingSetsInSession.length === 0 ? lastSessionFirstSet : lastSet;

    addSet(db, currentSE.id, {
      userId,
      weight_value: prefillSource?.weight_value ?? null,
      weight_unit: prefillSource?.weight_unit ?? userUnit,
      reps: prefillSource?.reps ?? null,
      failure_metric: prefillSource?.failure_metric ?? defaultFailureMetric,
      rir: prefillSource?.rir ?? null,
      rpe: prefillSource?.rpe ?? null,
      is_warmup: false,
    });
  }, [db, currentSE, currentSets, lastSessionFirstSet, userId, userUnit, defaultFailureMetric]);

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
      // Last exercise → finish session. Commit active time first (TKT-0011) so
      // the summary duration reflects real active time, not wall-clock.
      commitNow();
      finishSession(db, sessionId);
      router.replace(`/session/summary/${sessionId}`);
    }
  }, [db, currentSE, sessionId, safeIndex, sessionExercises, router, commitNow]);

  const handleFinishWorkout = useCallback(() => {
    if (!db || !sessionId) return;
    if (currentSE) {
      goToNextExercise(db, sessionId, currentSE.id, null);
    }
    commitNow(); // TKT-0011: persist active time before computing the summary
    finishSession(db, sessionId);
    router.replace(`/session/summary/${sessionId}`);
  }, [db, sessionId, currentSE, router, commitNow]);

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

  const showMenu = useCallback(() => setMenuVisible(true), []);

  // Cross-platform action menu (native Android Alert silently drops options
  // beyond three — including cancel — so we use a Modal-based sheet instead).
  const menuOptions = useMemo(
    () => [
      { label: t('session.menu_add_exercise'), onPress: () => handleMenuAction(0) },
      { label: t('session.menu_swap_exercise'), onPress: () => handleMenuAction(1) },
      { label: t('session.menu_skip_exercise'), onPress: () => handleMenuAction(2), destructive: true },
      { label: t('session.menu_group_superset'), onPress: () => handleMenuAction(3) },
      { label: t('session.menu_group_dropset'), onPress: () => handleMenuAction(4) },
    ],
    [t, handleMenuAction],
  );

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

  // ── TKT-0022: Swipe gesture + chevrons ───────────────────────────────────
  const hasPrev = safeIndex > 0;
  const hasNext = safeIndex < sessionExercises.length - 1;

  const handlePrevExercise = useCallback(() => {
    if (hasPrev) setExerciseIndex(safeIndex - 1);
  }, [hasPrev, safeIndex]);

  const handleNextExerciseChevron = useCallback(() => {
    if (hasNext) setExerciseIndex(safeIndex + 1);
  }, [hasNext, safeIndex]);

  // Horizontal swipe: left swipe → next exercise, right swipe → previous.
  // Threshold: 60 dp to distinguish from text input horizontal scrolling.
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-60, 60])
    .failOffsetY([-20, 20])
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationX < -60 && hasNext) {
        setExerciseIndex(safeIndex + 1);
      } else if (e.translationX > 60 && hasPrev) {
        setExerciseIndex(safeIndex - 1);
      }
    });

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
      {/* Exercise action menu (add / swap / skip / superset / dropset) */}
      <ActionMenu
        visible={menuVisible}
        title={t('session.exercise_menu_title')}
        options={menuOptions}
        onClose={() => setMenuVisible(false)}
      />

      {/* TKT-0011: stale-session recovery prompt */}
      <StaleSessionModal
        visible={staleModalVisible}
        onContinue={handleStaleContinue}
        onFinishWithDuration={handleStaleFinishWithDuration}
        onDiscard={handleStaleDiscard}
      />

      {/* PR Badge (absolute overlay) */}
      {prInfo ? (
        <PRBadge
          exerciseName={prInfo.exerciseName}
          weight={prInfo.weight}
          reps={prInfo.reps}
          prType={prInfo.prType}
          delta={prInfo.delta}
          userUnit={userUnit}
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
          {/* TKT-0011: real active time, not Date.now() - started_at */}
          <Text
            style={styles.sessionTimerText}
            accessibilityLabel={t('session.session_timer_label')}
          >
            {formatMmSs(displaySeconds)}
          </Text>
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
          {/* TKT-0014 / TKT-0018: "Last time" line */}
          {lastSessionFirstSet ? (
            <Text
              style={styles.lastTimeText}
              accessibilityLabel={
                lastSessionFirstSet.rir != null
                  ? t('session.last_time', {
                      weight: formatWeight(lastSessionFirstSet, userUnit),
                      reps: lastSessionFirstSet.reps ?? '?',
                      rir: lastSessionFirstSet.rir,
                    })
                  : t('session.last_time_no_rir', {
                      weight: formatWeight(lastSessionFirstSet, userUnit),
                      reps: lastSessionFirstSet.reps ?? '?',
                    })
              }
            >
              {lastSessionFirstSet.rir != null
                ? t('session.last_time', {
                    weight: formatWeight(lastSessionFirstSet, userUnit),
                    reps: lastSessionFirstSet.reps ?? '?',
                    rir: lastSessionFirstSet.rir,
                  })
                : t('session.last_time_no_rir', {
                    weight: formatWeight(lastSessionFirstSet, userUnit),
                    reps: lastSessionFirstSet.reps ?? '?',
                  })}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.exerciseHeader}>
          <Text style={styles.noExercisesText}>{t('session.no_exercises')}</Text>
        </View>
      )}

      {/* ── Column headers + sets list (wrapped in swipe gesture) ── */}
      {/* TKT-0022: GestureDetector enables left/right swipe between exercises */}
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.swipeContainer}>
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
            key={`${set.id}:${set.updated_at}`}
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
            onToggleReachedFailure={() =>
              updateSet(db, set.id, { reached_failure: !set.reached_failure })
            }
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
        </View>
      </GestureDetector>

      {/* ── Position dots + chevrons (TKT-0022) ── */}
      <View style={styles.pagerRow}>
        <Pressable
          onPress={handlePrevExercise}
          style={[styles.chevronButton, !hasPrev && styles.chevronButtonHidden]}
          accessibilityRole="button"
          accessibilityLabel={t('session.prev_exercise')}
          accessibilityState={{ disabled: !hasPrev }}
          hitSlop={8}
          disabled={!hasPrev}
        >
          <Ionicons name="chevron-back" size={20} color={hasPrev ? colors.textSecondary : 'transparent'} />
        </Pressable>
        <ExercisePager
          total={sessionExercises.length}
          currentIndex={safeIndex}
          onSelect={(i) => setExerciseIndex(i)}
        />
        <Pressable
          onPress={handleNextExerciseChevron}
          style={[styles.chevronButton, !hasNext && styles.chevronButtonHidden]}
          accessibilityRole="button"
          accessibilityLabel={t('session.next_exercise_chevron')}
          accessibilityState={{ disabled: !hasNext }}
          hitSlop={8}
          disabled={!hasNext}
        >
          <Ionicons name="chevron-forward" size={20} color={hasNext ? colors.textSecondary : 'transparent'} />
        </Pressable>
      </View>

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
  lastTimeText: { ...typography.label, color: colors.textTertiary, fontStyle: 'italic', fontSize: 11 },

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

  // TKT-0022: swipe gesture wrapper
  swipeContainer: { flex: 1 },

  // TKT-0022: pager row with chevrons
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  chevronButton: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronButtonHidden: {
    opacity: 0,
  },

  // Position dots (legacy — keep for reference)
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
