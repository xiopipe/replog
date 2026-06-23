/**
 * Routines list screen — shows user's routines with entry to create/edit.
 * This is the main content when navigating from the Routines tab.
 *
 * TKT-0051: After the existing confirmation dialog soft-deletes a routine,
 * a 3-second "Deshacer" snackbar appears; tapping it clears deleted_at to restore.
 */
import { useRows, restoreItem } from '@/db';
import { useRouter } from 'expo-router';
import { useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography, TOUCH_TARGET } from '@/lib/theme';
import { getRoutines } from '@/features/routines/queries';
import { deleteRoutine } from '@/features/routines/mutations';
import type { RoutineRow } from '@/db';
import { EmptyState } from '@/components/EmptyState';
import { Snackbar } from '@/components/Snackbar';

export default function RoutinesListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { db } = useAuth();

  const rawRoutines = useRows(db?.routines$);
  const rawRoutineExercises = useRows(db?.routineExercises$);

  // TKT-0051: track the last deleted routine id for undo
  const [undoRoutineId, setUndoRoutineId] = useState<string | null>(null);

  const isLoading = rawRoutines === undefined || rawRoutines === null;

  const routines = useMemo(() => getRoutines(rawRoutines ?? {}), [rawRoutines]);

  const exerciseCountMap = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const re of Object.values(rawRoutineExercises ?? {})) {
      if (!re.deleted_at) {
        map.set(re.routine_id, (map.get(re.routine_id) ?? 0) + 1);
      }
    }
    return map;
  }, [rawRoutineExercises]);

  const getExerciseCount = useCallback(
    (routineId: string): number => exerciseCountMap.get(routineId) ?? 0,
    [exerciseCountMap],
  );

  const handleDelete = (routine: RoutineRow) => {
    if (!db) return;
    Alert.alert(
      routine.name,
      t('routines.delete_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            // Soft-delete immediately (the existing filter excludes it from the list)
            deleteRoutine(db, routine.id);
            // Show undo snackbar
            setUndoRoutineId(routine.id);
          },
        },
      ],
    );
  };

  // TKT-0051: restore the soft-deleted routine within the undo window
  const handleUndo = useCallback(() => {
    if (!db || !undoRoutineId) return;
    restoreItem(db.routines$, undoRoutineId);
    setUndoRoutineId(null);
  }, [db, undoRoutineId]);

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
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('routines.title')}
        </Text>
        <Pressable
          onPress={() => router.push('/routines/editor')}
          style={styles.addBtn}
          accessibilityRole="button"
          accessibilityLabel={t('routines.new_routine')}
          hitSlop={8}
        >
          <Ionicons name="add" size={26} color={colors.accent} />
        </Pressable>
      </View>
      <View style={styles.divider} />

      <FlatList
        data={routines}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState message={t('routines.empty')} />}
        renderItem={({ item }) => (
          <RoutineItem
            routine={item}
            exerciseCount={getExerciseCount(item.id)}
            onEdit={() => router.push(`/routines/editor?id=${item.id}`)}
            onDelete={() => handleDelete(item)}
            t={t}
          />
        )}
      />

      {/* TKT-0051: Undo snackbar */}
      <Snackbar
        visible={!!undoRoutineId}
        message={t('routines.undo_delete')}
        actionLabel={t('routines.undo_action')}
        onAction={handleUndo}
        onDismiss={() => setUndoRoutineId(null)}
        durationMs={3000}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Routine list item
// ---------------------------------------------------------------------------

function RoutineItem({
  routine,
  exerciseCount,
  onEdit,
  onDelete,
  t,
}: {
  routine: RoutineRow;
  exerciseCount: number;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [styles.routineRow, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
      accessibilityLabel={routine.name}
    >
      <View style={styles.routineInfo}>
        <Text style={styles.routineName} numberOfLines={1}>
          {routine.name}
        </Text>
        <Text style={styles.routineCount}>
          {t('routines.exercises_count', { count: exerciseCount })}
        </Text>
      </View>
      <Pressable
        onPress={onDelete}
        hitSlop={8}
        style={styles.deleteBtn}
        accessibilityRole="button"
        accessibilityLabel={t('routines.delete_hint')}
      >
        <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
      </Pressable>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  backBtn: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    flex: 1,
  },
  addBtn: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: colors.border },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: TOUCH_TARGET,
    gap: spacing.sm,
  },
  routineInfo: {
    flex: 1,
    gap: 2,
  },
  routineName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
    fontSize: 15,
  },
  routineCount: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 12,
  },
  deleteBtn: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
