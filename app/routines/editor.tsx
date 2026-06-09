/**
 * Routine editor screen.
 *
 * Create: /routines/editor   (no params)
 * Edit:   /routines/editor?id=<routineId>
 *
 * Features:
 *  - Name + optional notes fields
 *  - Reorderable exercise list (drag via react-native-draggable-flatlist)
 *  - Per-exercise target editing (sets, reps, RIR) in a bottom sheet modal
 *  - "Add exercise" opens the catalog in picker mode
 *  - Save validates name + ≥1 exercise
 */
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { use$ } from '@legendapp/state/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/lib/auth';
import { globalExercises$ } from '@/db';
import { colors, spacing, radius, typography, TOUCH_TARGET } from '@/lib/theme';
import {
  getRoutineExercises,
  buildTargetSummary,
  type RoutineExerciseWithExercise,
} from '@/features/routines/queries';
import {
  createRoutine,
  updateRoutine,
  reorderRoutineExercises,
  removeExerciseFromRoutine,
  updateExerciseTargets,
} from '@/features/routines/mutations';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function RoutineEditorScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id: routineId } = useLocalSearchParams<{ id?: string }>();
  const { db, session } = useAuth();

  // Observables
  const rawRoutines = use$(db?.routines$);
  const rawRoutineExercises = use$(db?.routineExercises$);
  const globalExercises = use$(globalExercises$);
  const rawUserExercises = use$(db?.userExercises$);

  // Local state
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<RoutineExerciseWithExercise | null>(null);

  // Track the active routine id (may be created fresh on first save)
  const [localRoutineId, setLocalRoutineId] = useState<string | undefined>(routineId);

  // Sync name/notes from existing routine (edit mode)
  const existingRoutine = localRoutineId ? rawRoutines?.[localRoutineId] : undefined;
  const isEdit = !!routineId;

  const initializedRef = useRef(false);
  useEffect(() => {
    if (existingRoutine && !initializedRef.current) {
      setName(existingRoutine.name);
      setNotes(existingRoutine.notes ?? '');
      initializedRef.current = true;
    }
  }, [existingRoutine]);

  // Current exercise list for this routine
  const exercises: RoutineExerciseWithExercise[] = useMemo(() => {
    if (!localRoutineId) return [];
    return getRoutineExercises(
      rawRoutineExercises ?? {},
      globalExercises ?? {},
      rawUserExercises ?? {},
      localRoutineId,
    );
  }, [rawRoutineExercises, globalExercises, rawUserExercises, localRoutineId]);

  // For drag-reorder we pass `exercises` directly as the `data` prop.
  // DraggableFlatList calls onDragEnd with the reordered array; we persist
  // that to the DB immediately so the observable re-renders with the new order.
  // No separate local copy needed — the observable IS the source of truth.

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    Keyboard.dismiss();
    const trimmedName = name.trim();

    // Validation
    let valid = true;
    if (!trimmedName) {
      setNameError(t('routine_editor.error_name_required'));
      valid = false;
    } else {
      setNameError(null);
    }
    if (exercises.length === 0) {
      setExerciseError(t('routine_editor.error_min_exercise'));
      valid = false;
    } else {
      setExerciseError(null);
    }
    if (!valid) return;

    if (!db || !session) return;

    setSaving(true);
    try {
      const userId = session.user.id;
      if (!localRoutineId) {
        // Create new
        const newId = createRoutine(db, { name: trimmedName, notes: notes.trim() || null, userId });
        setLocalRoutineId(newId);
      } else {
        // Update existing
        updateRoutine(db, localRoutineId, { name: trimmedName, notes: notes.trim() || null });
      }
      router.back();
    } catch (e) {
      console.error('[editor] save error', e);
      Alert.alert(t('routine_editor.error_save'));
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Drag end — persist new order
  // ---------------------------------------------------------------------------

  const handleDragEnd = useCallback(
    ({ data }: { data: RoutineExerciseWithExercise[] }) => {
      if (db) {
        reorderRoutineExercises(
          db,
          data.map((re) => re.id),
        );
      }
    },
    [db],
  );

  // ---------------------------------------------------------------------------
  // Add exercise: ensure routine exists, then navigate to catalog in picker mode
  // ---------------------------------------------------------------------------

  const handleAddExercise = async () => {
    if (!db || !session) return;

    let routineIdToUse = localRoutineId;

    if (!routineIdToUse) {
      // Create the routine first (without requiring name validation at this point)
      // If name is empty, use a placeholder that the user must fix before saving
      const trimmedName = name.trim();
      if (!trimmedName) {
        setNameError(t('routine_editor.error_name_required'));
        return;
      }
      const userId = session.user.id;
      const newId = createRoutine(db, { name: trimmedName, notes: notes.trim() || null, userId });
      setLocalRoutineId(newId);
      routineIdToUse = newId;
    }

    router.push(`/catalog?pickFor=${routineIdToUse}`);
  };

  // ---------------------------------------------------------------------------
  // Remove exercise
  // ---------------------------------------------------------------------------

  const handleRemove = (re: RoutineExerciseWithExercise) => {
    if (!db) return;
    Alert.alert(
      re.exercise.name,
      t('routine_editor.remove_exercise'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => removeExerciseFromRoutine(db, re.id),
        },
      ],
    );
  };

  // ---------------------------------------------------------------------------
  // Render exercise row (passed to DraggableFlatList)
  // ---------------------------------------------------------------------------

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<RoutineExerciseWithExercise>) => (
      <ExerciseItem
        item={item}
        isActive={isActive}
        drag={drag}
        onEditTargets={() => setEditingTarget(item)}
        onRemove={() => handleRemove(item)}
        t={t}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, db],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isLoading = !db;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header">
            {isEdit ? t('routine_editor.title_edit') : t('routine_editor.title_create')}
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={t('routine_editor.save')}
            hitSlop={8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={styles.saveText}>{t('routine_editor.save')}</Text>
            )}
          </Pressable>
        </View>
        <View style={styles.divider} />

        {/* Name field */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>{t('routine_editor.name_label')}</Text>
          <TextInput
            style={[styles.nameInput, nameError && styles.inputError]}
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (v.trim()) setNameError(null);
            }}
            placeholder={t('routine_editor.name_placeholder')}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={t('routine_editor.name_label')}
            returnKeyType="done"
            maxLength={80}
          />
          {nameError && <Text style={styles.errorText}>{nameError}</Text>}
        </View>

        {/* Exercises section header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>{t('routine_editor.exercises_section')}</Text>
        </View>

        {exerciseError && (
          <Text style={[styles.errorText, { paddingHorizontal: spacing.lg }]}>
            {exerciseError}
          </Text>
        )}

        {/* Draggable exercise list */}
        <DraggableFlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          onDragEnd={handleDragEnd}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyExercises}>
              <Text style={styles.emptyText}>{t('routine_editor.exercises_section')}</Text>
            </View>
          }
          ListFooterComponent={
            <AddExerciseButton onPress={handleAddExercise} t={t} />
          }
          activationDistance={10}
        />
      </KeyboardAvoidingView>

      {/* Target editor modal */}
      {editingTarget && db && session && (
        <TargetEditorModal
          item={editingTarget}
          onClose={() => setEditingTarget(null)}
          onSave={(targets) => {
            updateExerciseTargets(db, editingTarget.id, targets);
            setEditingTarget(null);
          }}
          t={t}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Exercise item row
// ---------------------------------------------------------------------------

function ExerciseItem({
  item,
  isActive,
  drag,
  onEditTargets,
  onRemove,
  t,
}: {
  item: RoutineExerciseWithExercise;
  isActive: boolean;
  drag: () => void;
  onEditTargets: () => void;
  onRemove: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const summary = buildTargetSummary(item, {
    setsReps: (sets, min, max) =>
      t('routine_editor.target_summary_sets_reps', { sets, min, max }),
    setsFixed: (sets, reps) =>
      t('routine_editor.target_summary_sets_fixed', { sets, reps }),
    setsFailure: (sets) =>
      t('routine_editor.target_summary_sets_failure', { sets }),
    reps: (min, max) =>
      min === max
        ? t('routine_editor.target_summary_reps', { reps: min })
        : t('routine_editor.target_summary_sets_reps', { sets: '', min, max }).trimStart(),
    failure: t('routine_editor.target_summary_failure'),
    none: t('routine_editor.target_summary_none'),
  });

  return (
    <Pressable
      onPress={onEditTargets}
      style={({ pressed }) => [
        styles.exerciseRow,
        isActive && styles.exerciseRowActive,
        pressed && !isActive && { opacity: 0.8 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.exercise.name} — ${t('routine_editor.edit_targets')}`}
    >
      {/* Drag handle */}
      <TouchableOpacity
        onLongPress={drag}
        delayLongPress={100}
        style={styles.dragHandle}
        accessibilityRole="button"
        accessibilityLabel={t('routine_editor.drag_hint')}
      >
        <Ionicons name="menu" size={20} color={colors.textTertiary} />
      </TouchableOpacity>

      {/* Name + target */}
      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseName} numberOfLines={1}>
          {item.exercise.name}
        </Text>
        <Text style={styles.targetSummary} numberOfLines={1}>
          {summary}
        </Text>
      </View>

      {/* Remove */}
      <TouchableOpacity
        onPress={onRemove}
        hitSlop={8}
        style={styles.removeBtn}
        accessibilityRole="button"
        accessibilityLabel={t('routine_editor.remove_exercise_hint')}
      >
        <Ionicons name="close" size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Add exercise button
// ---------------------------------------------------------------------------

function AddExerciseButton({
  onPress,
  t,
}: {
  onPress: () => void;
  t: (key: string) => string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
      accessibilityLabel={t('routine_editor.add_exercise')}
    >
      <Text style={styles.addBtnText}>{t('routine_editor.add_exercise')}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Target editor modal
// ---------------------------------------------------------------------------

interface TargetValues {
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_weight_kg: number | null;
  target_rir: number | null;
}

function TargetEditorModal({
  item,
  onClose,
  onSave,
  t,
}: {
  item: RoutineExerciseWithExercise;
  onClose: () => void;
  onSave: (targets: TargetValues) => void;
  t: (key: string) => string;
}) {
  const [sets, setSets] = useState(item.target_sets?.toString() ?? '');
  const [repsMin, setRepsMin] = useState(item.target_reps_min?.toString() ?? '');
  const [repsMax, setRepsMax] = useState(item.target_reps_max?.toString() ?? '');
  const [weight, setWeight] = useState(item.target_weight_kg?.toString() ?? '');
  const [rir, setRir] = useState(item.target_rir?.toString() ?? '');

  const parseIntOrNull = (s: string): number | null => {
    const n = parseInt(s, 10);
    return isNaN(n) ? null : n;
  };
  const parseFloatOrNull = (s: string): number | null => {
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  };

  const handleSave = () => {
    onSave({
      target_sets: parseIntOrNull(sets),
      target_reps_min: parseIntOrNull(repsMin),
      target_reps_max: parseIntOrNull(repsMax),
      target_weight_kg: parseFloatOrNull(weight),
      target_rir: parseIntOrNull(rir),
    });
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{item.exercise.name}</Text>

          <ScrollView style={styles.targetScrollView} keyboardShouldPersistTaps="handled">
            <TargetField
              label={t('routine_editor.target_sets_label')}
              value={sets}
              onChangeText={setSets}
              placeholder="—"
            />
            <TargetField
              label={`${t('routine_editor.target_reps_label')} (mín)`}
              value={repsMin}
              onChangeText={setRepsMin}
              placeholder="—"
            />
            <TargetField
              label={`${t('routine_editor.target_reps_label')} (máx)`}
              value={repsMax}
              onChangeText={setRepsMax}
              placeholder="—"
            />
            <TargetField
              label={t('routine_editor.target_weight_label')}
              value={weight}
              onChangeText={setWeight}
              placeholder="—"
              decimal
            />
            <TargetField
              label={t('routine_editor.target_rir_label')}
              value={rir}
              onChangeText={setRir}
              placeholder="—"
            />
          </ScrollView>

          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.modalSecBtn, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.modalSecTxt}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [styles.modalPrimBtn, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
            >
              <Text style={styles.modalPrimTxt}>{t('common.save')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TargetField({
  label,
  value,
  onChangeText,
  placeholder,
  decimal = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  decimal?: boolean;
}) {
  return (
    <View style={styles.targetRow}>
      <Text style={styles.targetLabel}>{label}</Text>
      <TextInput
        style={styles.targetInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        accessibilityLabel={label}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  kav: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  headerBtn: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.section,
    color: colors.textPrimary,
    flex: 1,
    fontSize: 17,
  },
  saveText: {
    ...typography.label,
    fontSize: 14,
    color: colors.accent,
    fontWeight: '500',
  },
  divider: { height: 1, backgroundColor: colors.border },

  fieldSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameInput: {
    ...typography.section,
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    fontSize: 18,
  },
  inputError: {
    borderBottomColor: colors.error,
  },
  errorText: {
    ...typography.label,
    color: colors.error,
    marginTop: spacing.xs,
  },

  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },

  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 56,
    paddingRight: spacing.sm,
  },
  exerciseRowActive: {
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  dragHandle: {
    width: TOUCH_TARGET,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseInfo: {
    flex: 1,
    gap: 2,
    paddingVertical: spacing.sm,
  },
  exerciseName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
    fontSize: 14,
  },
  targetSummary: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 12,
  },
  removeBtn: {
    width: TOUCH_TARGET,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addBtn: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    minHeight: TOUCH_TARGET + spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    ...typography.section,
    color: colors.accent,
    fontSize: 14,
  },

  emptyExercises: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textTertiary,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg * 2,
    borderTopRightRadius: radius.lg * 2,
    paddingBottom: spacing.xl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.section,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  targetScrollView: {
    maxHeight: 320,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: TOUCH_TARGET,
  },
  targetLabel: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
    fontSize: 14,
  },
  targetInput: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'right',
    minWidth: 80,
    paddingVertical: spacing.xs,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  modalSecBtn: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecTxt: {
    ...typography.body,
    color: colors.textSecondary,
  },
  modalPrimBtn: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimTxt: {
    ...typography.body,
    color: colors.onAccent,
    fontWeight: '500',
  },
});
