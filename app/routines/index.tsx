/**
 * Routines list screen — shows user's routines with entry to create/edit.
 * This is the main content when navigating from the Routines tab.
 */
import { use$ } from '@legendapp/state/react';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
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

export default function RoutinesListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { db } = useAuth();

  const rawRoutines = use$(db?.routines$);
  const rawRoutineExercises = use$(db?.routineExercises$);

  const isLoading = rawRoutines === undefined || rawRoutines === null;

  const routines = useMemo(() => getRoutines(rawRoutines ?? {}), [rawRoutines]);

  const getExerciseCount = (routineId: string): number =>
    Object.values(rawRoutineExercises ?? {}).filter(
      (re) => re.routine_id === routineId && !re.deleted_at,
    ).length;

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
          onPress: () => deleteRoutine(db, routine.id),
        },
      ],
    );
  };

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
          {t('routines.exercises_count_one', { count: exerciseCount })}
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
