/**
 * Active session screen — the focused workout walkthrough.
 *
 * Route: /session/[id]  (Stack route; tab bar is hidden — no (tabs) group)
 *
 * One exercise at a time. Progress dots. Session timer + per-exercise timer.
 * Inline set rows. ⋮ menu for add/swap/skip/superset/dropset.
 * PR micro-celebration on confirming a working set.
 * "Siguiente ejercicio →" or "Finalizar" primary action.
 *
 * TKT-0017: Routine target ghost reference chip near exercise header.
 * TKT-0019: Auto-advance focus between fields (handled inside SetRow).
 * TKT-0026: Long-press "Duplicate" offers same/+rep/+weight variants.
 * TKT-0050: Haptics on set confirm + PR; keep-awake during active session.
 * TKT-0059: Two-panel layout — scrollable history top, pinned active-row bottom.
 */

import { useRows, softDelete, globalExercises$ } from '@/db';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import type { ExerciseRow, FailureMetricEnum, RoutineExerciseRow, SetRow as SetRowData, UnitEnum } from '@/db';
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
  countExercisesWithoutWorkingSets,
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
  reorderSessionExercises,
} from '@/features/session/mutations';
import { isSessionStale } from '@/features/session/activeTime';
import { useActiveSessionTimer } from '@/features/session/useActiveSessionTimer';

import { ActionMenu } from '@/components/ActionMenu';
import { SessionTimer, formatMmSs } from '@/features/session/SessionTimer';
import { StaleSessionModal } from '@/features/session/StaleSessionModal';
import { ExercisePager } from '@/features/session/ExercisePager';
import { SetRow } from '@/features/session/SetRow';
import { formatWeight } from '@/features/session/weight-format';
import { PRBadge, type PRType } from '@/features/session/PRBadge';
import { RoutineTargetChip } from '@/features/session/RoutineTargetChip';
import { ReorderExercisesModal, type ReorderItem } from '@/features/session/ReorderExercisesModal';

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
  const insets = useSafeAreaInsets();

  const { db, session } = useAuth();
  const userId = session?.user?.id ?? '';

  // ── Observable reads ──────────────────────────────────────────────────────
  const rawSessions = useRows(db?.workoutSessions$);
  const rawSessionExercises = useRows(db?.sessionExercises$);
  const rawSets = useRows(db?.sets$);
  const rawProfiles = useRows(db?.profiles$);
  const rawRoutineExercises = useRows(db?.routineExercises$);
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

  // ── TKT-0020: reorder exercises modal ────────────────────────────────────
  const [reorderVisible, setReorderVisible] = useState(false);

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

  // ── TKT-0050: keep-awake while session is active ──────────────────────────
  useEffect(() => {
    if (!sessionIsActive) return;
    activateKeepAwakeAsync().catch(() => { /* best-effort */ });

    // Also deactivate on background transition
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        deactivateKeepAwake();
      } else if (state === 'active') {
        activateKeepAwakeAsync().catch(() => { /* best-effort */ });
      }
    });

    return () => {
      deactivateKeepAwake();
      sub.remove();
    };
  }, [sessionIsActive]);

  // ── TKT-0011: stale-session recovery prompt ────────────────────────────────
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
      commitNow();
      setActiveTime(db, sessionId, Math.max(1, Math.floor(seconds)));
      finishSession(db, sessionId);
      // TKT-0030: pass `edit=1` so summary pre-focuses the duration field.
      router.replace(`/session/summary/${sessionId}?edit=1`);
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

  // TKT-0020: items for the reorder modal (SE rows + resolved exercise names)
  const reorderItems = useMemo<ReorderItem[]>(
    () =>
      sessionExercises.map((se) => ({
        se,
        exercise: allExercises[se.exercise_id] ?? null,
      })),
    [sessionExercises, allExercises],
  );

  // Profile preferences
  const userUnit: UnitEnum = useMemo(
    () => getUserUnitPreference(rawProfiles ?? {}, userId),
    [rawProfiles, userId],
  );
  const defaultFailureMetric: FailureMetricEnum = useMemo(
    () => getUserDefaultFailureMetric(rawProfiles ?? {}, userId),
    [rawProfiles, userId],
  );

  // ── TKT-0014: Last session sets ───────────────────────────────────────────
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

  const lastSessionFirstSet = lastSessionSets[0] ?? null;

  // ── TKT-0017: Routine target for current exercise ─────────────────────────
  const routineExerciseForCurrent = useMemo<RoutineExerciseRow | null>(() => {
    if (!currentSession?.routine_id || !rawRoutineExercises || !currentSE) return null;
    const allRE = Object.values(rawRoutineExercises);
    // Match by routine_id AND exercise_id
    return (
      allRE.find(
        (re) =>
          re.routine_id === currentSession.routine_id &&
          re.exercise_id === currentSE.exercise_id &&
          !re.deleted_at,
      ) ?? null
    );
  }, [currentSession, rawRoutineExercises, currentSE]);

  // ── Confirm set with PR detection ─────────────────────────────────────────
  const handleConfirmSet = useCallback(
    (setId: string, patch: Partial<SetRowData>, exerciseId: string) => {
      if (!db) return;

      updateSet(db, setId, patch);

      // TKT-0050: haptic on set confirm
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { /* best-effort */ });

      const existing = rawSets?.[setId] ?? ({} as Partial<SetRowData>);
      const mergedWeightValue = 'weight_value' in patch ? patch.weight_value : existing.weight_value;
      const mergedWeightUnit = 'weight_unit' in patch ? patch.weight_unit : existing.weight_unit;
      const computedWeightKg =
        mergedWeightValue != null && mergedWeightUnit != null
          ? toCanonicalKg(mergedWeightValue, mergedWeightUnit as 'kg' | 'lb')
          : (existing.weight_kg ?? null);

      const currentIsWarmup =
        patch.is_warmup !== undefined ? patch.is_warmup : (rawSets?.[setId]?.is_warmup ?? false);

      const updatedSet = {
        ...existing,
        ...patch,
        weight_kg: computedWeightKg,
        is_warmup: currentIsWarmup,
      } as SetRowData;

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
          const resolvedPrType: PRType = is1RM ? '1rm' : 'rep';

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

          // TKT-0050: haptic on PR
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { /* best-effort */ });

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

  // ── TKT-0026: Duplicate set (plain) ──────────────────────────────────────
  const handleDuplicateSet = useCallback(() => {
    if (!db || !currentSE) return;
    const lastSet = currentSets[currentSets.length - 1];
    if (!lastSet) {
      handleAddSet();
      return;
    }
    duplicateSet(db, lastSet);
  }, [db, currentSE, currentSets, handleAddSet]);

  // ── TKT-0026: Duplicate with increment (long-press variants) ─────────────
  const handleDuplicateVariant = useCallback(
    (weightDelta: number, repsDelta: number) => {
      if (!db || !currentSE) return;
      const lastSet = currentSets[currentSets.length - 1];
      if (!lastSet) {
        handleAddSet();
        return;
      }

      if (weightDelta === 0 && repsDelta === 0) {
        // Plain duplicate
        duplicateSet(db, lastSet);
        return;
      }

      // Duplicate with increments applied
      const newWeightValue =
        lastSet.weight_value != null ? lastSet.weight_value + weightDelta : weightDelta || null;
      const newReps = lastSet.reps != null ? lastSet.reps + repsDelta : repsDelta || null;

      addSet(db, currentSE.id, {
        userId,
        weight_value: newWeightValue,
        weight_unit: lastSet.weight_unit ?? userUnit,
        reps: newReps,
        failure_metric: lastSet.failure_metric ?? defaultFailureMetric,
        rir: lastSet.rir ?? null,
        rpe: lastSet.rpe ?? null,
        is_warmup: false,
      });
    },
    [db, currentSE, currentSets, userId, userUnit, defaultFailureMetric, handleAddSet],
  );

  const handleDuplicateLongPress = useCallback(() => {
    const lastSet = currentSets[currentSets.length - 1];
    if (!lastSet) return;

    Alert.alert(
      t('session.duplicate_set'),
      undefined,
      [
        {
          text: t('session.duplicate_same'),
          onPress: () => handleDuplicateVariant(0, 0),
        },
        {
          text: t('session.duplicate_plus_rep'),
          onPress: () => handleDuplicateVariant(0, 1),
        },
        {
          text: t('session.duplicate_plus_weight'),
          onPress: () => handleDuplicateVariant(2.5, 0),
        },
        { text: t('common.cancel'), style: 'cancel' },
      ],
    );
  }, [currentSets, t, handleDuplicateVariant]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const confirmFinishIfNeeded = useCallback(
    (proceed: () => void) => {
      const isPlanned = currentSession?.routine_id != null;
      const remaining = rawSets ? countExercisesWithoutWorkingSets(sessionExercises, rawSets) : 0;
      if (!isPlanned || remaining === 0) {
        proceed();
        return;
      }
      Alert.alert(
        t('session.finish_confirm_title'),
        t('session.finish_confirm_body', { count: remaining }),
        [
          { text: t('session.finish_confirm_back'), style: 'cancel' },
          { text: t('session.finish_confirm_finish'), style: 'destructive', onPress: proceed },
        ],
      );
    },
    [currentSession, rawSets, sessionExercises, t],
  );

  const handleNextExercise = useCallback(() => {
    if (!db || !currentSE || !sessionId) return;

    const nextIndex = safeIndex + 1;
    const nextSE = sessionExercises[nextIndex] ?? null;

    if (nextSE) {
      goToNextExercise(db, sessionId, currentSE.id, nextSE.id);
      setExerciseIndex(nextIndex);
    } else {
      confirmFinishIfNeeded(() => {
        goToNextExercise(db, sessionId, currentSE.id, null);
        commitNow();
        finishSession(db, sessionId);
        router.replace(`/session/summary/${sessionId}`);
      });
    }
  }, [db, currentSE, sessionId, safeIndex, sessionExercises, router, commitNow, confirmFinishIfNeeded]);

  const handleFinishWorkout = useCallback(() => {
    if (!db || !sessionId) return;
    confirmFinishIfNeeded(() => {
      if (currentSE) {
        goToNextExercise(db, sessionId, currentSE.id, null);
      }
      commitNow();
      finishSession(db, sessionId);
      router.replace(`/session/summary/${sessionId}`);
    });
  }, [db, sessionId, currentSE, router, commitNow, confirmFinishIfNeeded]);

  // ── ⋮ Menu ────────────────────────────────────────────────────────────────

  const handleMenuAction = useCallback(
    (actionIndex: number) => {
      if (!db || !sessionId || !currentSE) return;

      switch (actionIndex) {
        case 0:
          router.push(`/catalog?pickForSession=${sessionId}`);
          break;
        case 1:
          router.push(`/catalog?swapSession=${sessionId}&swapSE=${currentSE.id}`);
          break;
        case 2:
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
        case 3:
          {
            const adjacentSE = sessionExercises[safeIndex + 1] ?? sessionExercises[safeIndex - 1];
            if (adjacentSE) {
              groupAsSuperset(db, [currentSE.id, adjacentSE.id]);
            }
          }
          break;
        case 4:
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

  // TKT-0020: confirm reorder → batch update order_index
  const handleReorderConfirm = useCallback(
    (orderedIds: string[]) => {
      if (!db) return;
      reorderSessionExercises(db, orderedIds);
      setReorderVisible(false);
    },
    [db],
  );

  const handleReorderCancel = useCallback(() => setReorderVisible(false), []);

  const menuOptions = useMemo(
    () => [
      { label: t('session.menu_add_exercise'), onPress: () => handleMenuAction(0) },
      { label: t('session.menu_swap_exercise'), onPress: () => handleMenuAction(1) },
      { label: t('session.menu_skip_exercise'), onPress: () => handleMenuAction(2), destructive: true },
      { label: t('session.menu_group_superset'), onPress: () => handleMenuAction(3) },
      { label: t('session.menu_group_dropset'), onPress: () => handleMenuAction(4) },
      // TKT-0020: reorder exercises
      { label: t('session.menu_reorder_exercises'), onPress: () => setReorderVisible(true) },
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
  const hasSets = currentSets.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Exercise action menu */}
      <ActionMenu
        visible={menuVisible}
        title={t('session.exercise_menu_title')}
        options={menuOptions}
        onClose={() => setMenuVisible(false)}
      />

      {/* TKT-0020: reorder exercises modal */}
      <ReorderExercisesModal
        visible={reorderVisible}
        items={reorderItems}
        onConfirm={handleReorderConfirm}
        onCancel={handleReorderCancel}
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

      {/*
       * TKT-0059: Two-panel layout
       * ┌─────────────────────────────────────────┐
       * │ scrollable: header + history + chevrons  │ flex: 1
       * ├─────────────────────────────────────────┤
       * │ KeyboardAvoidingView                     │
       * │   pinned active panel (add/dup buttons + │
       * │   set rows + next/finish)                │
       * └─────────────────────────────────────────┘
       */}
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.body}>

          {/* ── Top scrollable panel: exercise header + previous sets ── */}
          <ScrollView
            style={styles.historyScroll}
            contentContainerStyle={styles.historyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Exercise name + per-exercise timer */}
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

                {/* TKT-0017: Routine target chip */}
                {routineExerciseForCurrent ? (
                  <RoutineTargetChip
                    routineExercise={routineExerciseForCurrent}
                    currentSets={currentSets}
                  />
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

            {/* Column headers */}
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

            {/* Previous confirmed sets */}
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
          </ScrollView>

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

          {/* ── TKT-0059: Pinned bottom panel ── */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + spacing.sm }]}>
              {/* Add / Duplicate / Warmup buttons */}
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
                  {/* TKT-0026: long-press for +rep/+weight variants */}
                  <Pressable
                    onPress={hasSets ? handleDuplicateSet : undefined}
                    onLongPress={hasSets ? handleDuplicateLongPress : undefined}
                    style={[styles.setActionButton, !hasSets && styles.setActionButtonDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel={t('session.duplicate_set')}
                    accessibilityState={{ disabled: !hasSets }}
                    disabled={!hasSets}
                  >
                    <Text style={[styles.setActionText, !hasSets && styles.setActionTextDisabled]}>
                      {t('session.duplicate_set')}
                    </Text>
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

              {/* Next / Finish primary actions */}
              {!isFinishedSession ? (
                <View style={styles.primaryActions}>
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
                <View style={styles.primaryActions}>
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
            </View>
          </KeyboardAvoidingView>

        </View>
      </GestureDetector>
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

  // TKT-0059: two-panel body
  body: { flex: 1 },

  // Top scrollable panel
  historyScroll: { flex: 1 },
  historyContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    flexGrow: 1,
  },

  // Exercise name + timer
  exerciseHeader: {
    paddingHorizontal: spacing.sm,
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
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  colHeader: { ...typography.label, color: colors.textTertiary, fontSize: 11 },
  colHeaderIndex: { width: 24, textAlign: 'center' },
  colHeaderWide: { flex: 3 },
  colHeaderNarrow: { flex: 2 },
  colHeaderConfirm: { width: TOUCH_TARGET },

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

  // Pager row (chevrons)
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
  chevronButtonHidden: { opacity: 0 },

  // TKT-0059: pinned bottom panel
  bottomPanel: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },

  // Set action buttons (inside bottom panel)
  setActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  setActionButton: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  setActionButtonDisabled: {
    opacity: 0.38,
  },
  setActionText: { ...typography.label, color: colors.textPrimary, fontWeight: '500' },
  setActionTextDisabled: { color: colors.textTertiary },

  // Primary actions (next/finish)
  primaryActions: {
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
