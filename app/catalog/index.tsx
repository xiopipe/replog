/**
 * Catalog list screen.
 * Search + filter by muscle group, shows merged global + user exercises.
 *
 * TKT-0039: "Favoritos" section (if ≥1) then "Recientes" (last 5) above the
 * full list; both respect the active muscle/equipment filters; sections are
 * hidden when they have no results under the active filter.
 *
 * Picker modes:
 *   pickFor=<routineId>         — routine exercise picker (existing)
 *   pickForSession=<sessionId>  — session "add exercise" picker
 *   swapSession=<sessionId>&swapSE=<seId> — session "swap exercise" picker
 */
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
import { useRows, globalExercises$, globalExerciseMuscles$ } from '@/db';
import type { EquipmentEnum, MuscleEnum, ExerciseRow, ExerciseMuscleRow } from '@/db';
import { useAuth } from '@/lib/auth';
import { colors, spacing, typography, TOUCH_TARGET } from '@/lib/theme';
import { getFilteredExercises, type ExerciseWithMuscles } from '@/features/catalog/queries';
import { ExerciseRow as ExerciseRowComponent } from '@/features/catalog/ExerciseRow';
import { EQUIPMENT_KEYS, MUSCLE_KEYS } from '@/features/catalog/constants';
import { addExerciseToRoutine } from '@/features/routines/mutations';
import {
  addExerciseToSession,
  swapExercise,
} from '@/features/session/mutations';
import {
  getFavoriteExerciseIds,
  getRecentExerciseIds,
  filterExerciseIdsByFilters,
} from '@/features/catalog/favoritesRecents';

export default function CatalogScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { db, session } = useAuth();
  const {
    pickFor,
    pickForSession,
    swapSession,
    swapSE,
  } = useLocalSearchParams<{
    pickFor?: string;
    pickForSession?: string;
    swapSession?: string;
    swapSE?: string;
  }>();

  const isPickerMode = !!pickFor || !!pickForSession || !!swapSession;

  const [search, setSearch] = useState('');
  const [filterMuscle, setFilterMuscle] = useState<MuscleEnum | null>(null);
  const [filterEquipment, setFilterEquipment] = useState<EquipmentEnum | null>(null);

  // Reactive reads — these re-render when the observable changes
  const globalExercises = useRows(globalExercises$);
  const globalMuscles = useRows(globalExerciseMuscles$);
  const rawUserExercises = useRows(db?.userExercises$);
  const rawUserMuscles = useRows(db?.userExerciseMuscles$);
  const rawRoutineExercises = useRows(db?.routineExercises$);
  const rawFavorites = useRows(db?.exerciseFavorites$);
  const rawSessionExercises = useRows(db?.sessionExercises$);
  const rawSessions = useRows(db?.workoutSessions$);

  const isLoading = globalExercises === null || globalMuscles === null;

  // Combined exercise + muscle maps for filter helpers
  const allExercisesMap = useMemo<Record<string, ExerciseRow>>(
    () => ({ ...(globalExercises ?? {}), ...(rawUserExercises ?? {}) }),
    [globalExercises, rawUserExercises],
  );
  const allMusclesMap = useMemo<Record<string, ExerciseMuscleRow>>(
    () => ({ ...(globalMuscles ?? {}), ...(rawUserMuscles ?? {}) }),
    [globalMuscles, rawUserMuscles],
  );

  // TKT-0039: Favorites — filtered by active muscle/equipment filters
  const filteredFavoriteIds = useMemo(() => {
    if (rawFavorites == null) return [];
    const favIds = Array.from(getFavoriteExerciseIds(rawFavorites));
    return filterExerciseIdsByFilters(favIds, allExercisesMap, allMusclesMap, filterMuscle, filterEquipment);
  }, [rawFavorites, allExercisesMap, allMusclesMap, filterMuscle, filterEquipment]);

  // TKT-0039: Recents — last 5 distinct exercises, filtered by active filters
  const filteredRecentIds = useMemo(() => {
    if (rawSessionExercises == null || rawSessions == null) return [];
    const recentIds = getRecentExerciseIds(rawSessionExercises, rawSessions, 5);
    return filterExerciseIdsByFilters(recentIds, allExercisesMap, allMusclesMap, filterMuscle, filterEquipment);
  }, [rawSessionExercises, rawSessions, allExercisesMap, allMusclesMap, filterMuscle, filterEquipment]);

  // Build ExerciseWithMuscles lookup from the filtered exercise list
  const exercises = useMemo(
    () =>
      getFilteredExercises(
        globalExercises ?? {},
        rawUserExercises ?? {},
        globalMuscles ?? {},
        rawUserMuscles ?? {},
        search,
        filterMuscle,
        filterEquipment,
      ),
    [
      globalExercises,
      rawUserExercises,
      globalMuscles,
      rawUserMuscles,
      search,
      filterMuscle,
      filterEquipment,
    ],
  );

  // Favorites and recents exercises resolved as ExerciseWithMuscles
  // We build a separate full (no search filter) lookup for section items
  const allFilteredExercises = useMemo(
    () =>
      getFilteredExercises(
        globalExercises ?? {},
        rawUserExercises ?? {},
        globalMuscles ?? {},
        rawUserMuscles ?? {},
        '', // no search filter for sections
        filterMuscle,
        filterEquipment,
      ),
    [globalExercises, rawUserExercises, globalMuscles, rawUserMuscles, filterMuscle, filterEquipment],
  );

  const allFilteredById = useMemo<Record<string, ExerciseWithMuscles>>(() => {
    const map: Record<string, ExerciseWithMuscles> = {};
    for (const ex of allFilteredExercises) map[ex.id] = ex;
    return map;
  }, [allFilteredExercises]);

  // Section items for favorites and recents (only shown when no search text)
  const favoriteItems = useMemo<ExerciseWithMuscles[]>(
    () =>
      search
        ? []
        : filteredFavoriteIds.map((id) => allFilteredById[id]).filter(Boolean) as ExerciseWithMuscles[],
    [search, filteredFavoriteIds, allFilteredById],
  );

  const recentItems = useMemo<ExerciseWithMuscles[]>(
    () =>
      search
        ? []
        : filteredRecentIds
            .filter((id) => !filteredFavoriteIds.includes(id)) // don't duplicate with favorites
            .map((id) => allFilteredById[id])
            .filter(Boolean) as ExerciseWithMuscles[],
    [search, filteredRecentIds, filteredFavoriteIds, allFilteredById],
  );

  const chipOptions: ChipOption[] = useMemo(
    () => [
      { key: '__all__', label: t('catalog.all_muscles') },
      ...MUSCLE_KEYS.map((m) => ({ key: m, label: t(`muscles.${m}`) })),
    ],
    [t],
  );

  const equipmentChipOptions: ChipOption[] = useMemo(
    () => [
      { key: '__all__', label: t('catalog.all_equipment') },
      ...EQUIPMENT_KEYS.map((e) => ({ key: e, label: t(`equipment.${e}`) })),
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

  const handleEquipmentSelect = (key: string | null) => {
    if (!key || key === '__all__') {
      setFilterEquipment(null);
    } else {
      setFilterEquipment(key as EquipmentEnum);
    }
  };

  const chipSelected = filterMuscle ?? '__all__';
  const equipmentSelected = filterEquipment ?? '__all__';

  /** In picker mode: add exercise to routine and go back. */
  const handlePickerSelect = (exerciseId: string) => {
    if (!db || !session) return;

    if (pickFor) {
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
      return;
    }

    if (pickForSession) {
      addExerciseToSession(db, pickForSession, exerciseId, session.user.id);
      router.back();
      return;
    }

    if (swapSession && swapSE) {
      swapExercise(db, swapSE, exerciseId);
      router.back();
      return;
    }
  };

  const handlePressExercise = (exerciseId: string) => {
    if (isPickerMode) {
      handlePickerSelect(exerciseId);
    } else {
      router.push(`/catalog/${exerciseId}`);
    }
  };

  const showSections = !search && (favoriteItems.length > 0 || recentItems.length > 0);

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

      {/* Filter chips: muscle group, then equipment */}
      <FilterChips
        options={chipOptions}
        selected={chipSelected}
        onSelect={handleChipSelect}
        accessibilityLabel={t('catalog.filter_by_muscle')}
      />
      <FilterChips
        options={equipmentChipOptions}
        selected={equipmentSelected}
        onSelect={handleEquipmentSelect}
        accessibilityLabel={t('catalog.filter_by_equipment')}
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
          ListHeaderComponent={
            showSections ? (
              <View style={styles.sectionsContainer}>
                {/* TKT-0039: Favorites section */}
                {favoriteItems.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{t('catalog_sections.favorites')}</Text>
                    {favoriteItems.map((item, idx) => (
                      <View key={item.id}>
                        {idx > 0 && <View style={styles.separator} />}
                        <ExerciseRowComponent
                          exercise={item}
                          onPress={() => handlePressExercise(item.id)}
                        />
                      </View>
                    ))}
                  </View>
                )}

                {/* TKT-0039: Recents section */}
                {recentItems.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{t('catalog_sections.recents')}</Text>
                    {recentItems.map((item, idx) => (
                      <View key={item.id}>
                        {idx > 0 && <View style={styles.separator} />}
                        <ExerciseRowComponent
                          exercise={item}
                          onPress={() => handlePressExercise(item.id)}
                        />
                      </View>
                    ))}
                  </View>
                )}

                {/* Divider before full list */}
                <View style={styles.fullListDivider} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              message={
                search || filterMuscle || filterEquipment
                  ? t('catalog.empty_search')
                  : t('catalog.empty_catalog')
              }
            />
          }
          renderItem={({ item }) => (
            <ExerciseRowComponent
              exercise={item}
              onPress={() => handlePressExercise(item.id)}
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
  // TKT-0039: sections
  sectionsContainer: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    fontSize: 11,
  },
  fullListDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
});
