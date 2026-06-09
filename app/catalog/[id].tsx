/**
 * Exercise detail screen.
 * Shows the muscle figure, instructions ("How to" tab), and best 1RM card.
 * Phase 1: no logged sets yet → 1RM card shows empty state.
 */
import { use$ } from '@legendapp/state/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { globalExercises$, globalExerciseMuscles$ } from '@/db';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';
import { getMusclesForExercise } from '@/features/catalog/queries';
import { MuscleFigure } from '@/features/catalog/MuscleFigure';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';

type TabKey = 'how_to' | 'history';

export default function ExerciseDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [activeTab, setActiveTab] = useState<TabKey>('how_to');

  const { db } = useAuth();

  const globalExercises = use$(globalExercises$);
  const globalMuscles = use$(globalExerciseMuscles$);
  const userExercises = use$(db?.userExercises$) ?? {};
  const userMuscles = use$(db?.userExerciseMuscles$) ?? {};

  const exercise =
    (globalExercises ?? {})[id] ??
    (userExercises)[id] ??
    null;

  const muscles = exercise
    ? getMusclesForExercise(globalMuscles ?? {}, userMuscles, id)
    : [];

  if (!exercise) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('exercise.detail_title')}
          </Text>
          <View style={styles.backButton} />
        </View>
        <EmptyState message={t('catalog.error_load')} />
      </SafeAreaView>
    );
  }

  const primaryMuscles = muscles.filter((m) => m.role === 'primary');
  const secondaryMuscles = muscles.filter((m) => m.role === 'secondary');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {exercise.name}
        </Text>
        <View style={styles.backButton} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'how_to' && styles.tabActive]}
          onPress={() => setActiveTab('how_to')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'how_to' }}
          accessibilityLabel={t('exercise.tab_how_to')}
        >
          <Text style={[styles.tabLabel, activeTab === 'how_to' && styles.tabLabelActive]}>
            {t('exercise.tab_how_to')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'history' }}
          accessibilityLabel={t('exercise.tab_history')}
        >
          <Text style={[styles.tabLabel, activeTab === 'history' && styles.tabLabelActive]}>
            {t('exercise.tab_history')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Muscle figure */}
        <View style={styles.figureContainer}>
          <MuscleFigure muscles={muscles} scale={1.3} />
        </View>

        {/* Muscle legend */}
        <View style={styles.legend}>
          {primaryMuscles.length > 0 && (
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors.musclePrimary }]} />
              <Text style={styles.legendText}>
                {`${t('exercise.primary_label')}: `}
                {primaryMuscles.map((m) => t(`muscles.${m.muscle}`)).join(', ')}
              </Text>
            </View>
          )}
          {secondaryMuscles.length > 0 && (
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors.muscleSecondary }]} />
              <Text style={styles.legendText}>
                {secondaryMuscles.map((m) => t(`muscles.${m.muscle}`)).join(', ')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {activeTab === 'how_to' && (
          <>
            {/* Instructions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('exercise.how_to_label')}</Text>
              <Text style={styles.instructions}>
                {exercise.instructions ?? t('exercise.no_instructions')}
              </Text>
            </View>

            {/* Best 1RM card */}
            <Card style={styles.card1rm}>
              <Text style={styles.card1rmLabel}>{t('exercise.best_mark')}</Text>
              <Text style={styles.card1rmEmpty}>{t('exercise.no_records')}</Text>
            </Card>

            {/* View history button */}
            <Button
              label={t('exercise.view_history')}
              variant="secondary"
              onPress={() => setActiveTab('history')}
              style={styles.historyButton}
            />
          </>
        )}

        {activeTab === 'history' && (
          <EmptyState message={t('exercise.no_records')} />
        )}
      </ScrollView>
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
  },
  backButton: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.section,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
  },
  tabActive: {
    borderBottomWidth: 2.5,
    borderBottomColor: colors.accent,
  },
  tabLabel: {
    ...typography.body,
    color: colors.textTertiary,
  },
  tabLabelActive: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  figureContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  section: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.textPrimary,
  },
  instructions: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  card1rm: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card1rmLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  card1rmEmpty: {
    ...typography.body,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  historyButton: {
    marginHorizontal: spacing.lg,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
});
