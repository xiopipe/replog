/**
 * Catalog list screen.
 * Search + filter by muscle group, shows merged global + user exercises.
 *
 * Picker mode: when the route has a `pickFor=<routineId>` query param,
 * tapping a row adds the exercise to that routine and navigates back
 * instead of opening the exercise detail.
 */
import { use$ } from '@legendapp/state/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { FilterChips, type ChipOption } from '@/components/FilterChips';
import { SearchBar } from '@/components/SearchBar';
import { EmptyState } from '@/components/EmptyState';
import { globalExercises$, globalExerciseMuscles$ } from '@/db';
import type { MuscleEnum } from '@/db';
import { useAuth } from '@/lib/auth';
import { colors, spacing, typography, TOUCH_TARGET } from '@/lib/theme';
import { getFilteredExercises } from '@/features/catalog/queries';
import { ExerciseRow } from '@/features/catalog/ExerciseRow';
import { MUSCLE_KEYS } from '@/features/catalog/constants';
import { addExerciseToRoutine } from '@/features/routines/mutations';

export default function CatalogScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { db, session } = useAuth();
  const { pickFor } = useLocalSearchParams<{ pickFor?: string }>();

  const isPickerMode = !!pickFor;

  const [search, setSearch] = useState('');
  const [filterMuscle, setFilterMuscle] = useState<MuscleEnum | null>(null);

  // Reactive reads — these re-render when the observable changes
  const globalExercises = use$(globalExercises$);
  const globalMuscles = use$(globalExerciseMuscles$);
  const rawUserExercises = use$(db?.userExercises$);
  const rawUserMuscles = use$(db?.userExerciseMuscles$);
  const rawRoutineExercises = use$(db?.routineExercises$);

  const isLoading = globalExercises === null || globalMuscles === null;

  const exercises = useMemo(
    () =>
      getFilteredExercises(
        globalExercises ?? {},
        rawUserExercises ?? {},
        globalMuscles ?? {},
        rawUserMuscles ?? {},
        search,
        filterMuscle,
      ),
    [globalExercises, rawUserExercises, globalMuscles, rawUserMuscles, search, filterMuscle],
  );

  const chipOptions: ChipOption[] = useMemo(
    () => [
      { key: '__all__', label: t('catalog.all_muscles') },
      ...MUSCLE_KEYS.map((m) => ({ key: m, label: t(`muscles.${m}`) })),
    ],
    [t],
  );

  const handleChipSelect = (key: string | null) => {
    if (!key || key === '__all__') {
      setFilterMuscle(null);
    } else {
      setFilterMuscle(key as MuscleEnum);
    }
  };

  const chipSelected = filterMuscle ?? '__all__';

  /** In picker mode: add exercise to routine and go back. */
  const handlePickerSelect = (exerciseId: string) => {
    if (!db || !session || !pickFor) return;

    // Compute the next order_index for this routine
    const existing = Object.values(rawRoutineExercises ?? {}).filter(
      (re) => re.routine_id === pickFor && !re.deleted_at,
    );
    const nextIndex = existing.length;

    addExerciseToRoutine(db, {
      routineId: pickFor,
      exerciseId,
      orderIndex: nextIndex,
      userId: session.user.id,
    });

    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('catalog.title')}
        </Text>
        {!isPickerMode && (
          <Pressable
            onPress={() => router.push('/catalog/create')}
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel={t('catalog.add_exercise')}
            hitSlop={8}
          >
            <Ionicons name="add" size={26} color={colors.accent} />
          </Pressable>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={t('catalog.search_placeholder')}
          accessibilityLabel={t('catalog.search_placeholder')}
        />
      </View>

      {/* Filter chips */}
      <FilterChips
        options={chipOptions}
        selected={chipSelected}
        onSelect={handleChipSelect}
        accessibilityLabel={t('catalog.title')}
      />

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <EmptyState
              message={search || filterMuscle ? t('catalog.empty_search') : t('catalog.empty_catalog')}
            />
          }
          renderItem={({ item }) => (
            <ExerciseRow
              exercise={item}
              onPress={
                isPickerMode
                  ? () => handlePickerSelect(item.id)
                  : () => router.push(`/catalog/${item.id}`)
              }
            />
          )}
        />
      )}
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  backButton: {
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
  addButton: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.sm,
    flexGrow: 1,
  },
  separator: {
    height: spacing.sm,
  },
});
