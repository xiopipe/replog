/**
 * Template picker screen.
 * Shows the 4 starter options: Full body 3 días, Upper/Lower, PPL, En blanco.
 * On selection, clones the template into the user's account and routes to the weekly plan.
 */
import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRows } from '@/db';

import { useAuth } from '@/lib/auth';
import { globalExercises$ } from '@/db';
import { colors, spacing, radius, typography, TOUCH_TARGET } from '@/lib/theme';
import { ALL_TEMPLATES, type TemplateConfig } from '@/features/routines/templates';
import { createPlanFromTemplate, createPlan } from '@/features/routines/mutations';

export default function TemplatesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { db, session } = useAuth();
  const globalExercises = useRows(globalExercises$);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (config: TemplateConfig) => {
    if (!db || !session) return;

    // Guard: non-blank templates need the catalog to be ready
    if (
      config.template !== null &&
      (!globalExercises || Object.keys(globalExercises).length === 0)
    ) {
      setError(t('templates.error_catalog_not_ready'));
      return;
    }

    setError(null);
    setCreating(true);

    try {
      const userId = session.user.id;

      if (config.template === null) {
        // Blank plan
        createPlan(db, { name: t('templates.blank'), userId });
      } else {
        createPlanFromTemplate(db, config.template, globalExercises ?? {}, userId);
      }

      // Navigate to weekly plan
      router.replace('/plan');
    } catch (e) {
      console.error('[templates] createPlan error', e);
      setError(t('templates.error_create'));
    } finally {
      setCreating(false);
    }
  };

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
          {t('templates.title')}
        </Text>
      </View>

      <Text style={styles.subtitle}>{t('templates.subtitle')}</Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {creating ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.creatingText}>{t('templates.creating')}</Text>
        </View>
      ) : (
        <FlatList
          data={ALL_TEMPLATES}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TemplateCard config={item} onSelect={handleSelect} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Template card
// ---------------------------------------------------------------------------

function TemplateCard({
  config,
  onSelect,
}: {
  config: TemplateConfig;
  onSelect: (c: TemplateConfig) => void;
}) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={() => onSelect(config)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={t(config.nameKey as any)}
      accessibilityHint={t(config.descKey as any)}
    >
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{t(config.nameKey as any)}</Text>
        <Text style={styles.cardDesc}>{t(config.descKey as any)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  errorBox: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  creatingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    minHeight: TOUCH_TARGET + spacing.xl,
  },
  cardPressed: {
    opacity: 0.75,
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    ...typography.section,
    color: colors.textPrimary,
  },
  cardDesc: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 13,
  },
});
