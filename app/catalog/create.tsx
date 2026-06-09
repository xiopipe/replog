/**
 * Create custom exercise screen.
 * Fields: name, category (equipment), primary muscles (multi-select),
 * secondary muscles (multi-select), is_bodyweight toggle, instructions.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { MultiSelect, type SelectOption } from '@/components/MultiSelect';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';
import { createCustomExercise } from '@/features/catalog/queries';
import { MUSCLE_KEYS } from '@/features/catalog/constants';
import type { EquipmentEnum, MuscleEnum } from '@/db';

const EQUIPMENT_KEYS: EquipmentEnum[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'other',
];

export default function CreateExerciseScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { db, session } = useAuth();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<EquipmentEnum>('barbell');
  const [primaryMuscles, setPrimaryMuscles] = useState<MuscleEnum[]>([]);
  const [secondaryMuscles, setSecondaryMuscles] = useState<MuscleEnum[]>([]);
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  // Validation errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [primaryError, setPrimaryError] = useState<string | null>(null);

  const muscleOptions: SelectOption[] = MUSCLE_KEYS.map((k) => ({
    key: k,
    label: t(`muscles.${k}`),
  }));

  const equipmentOptions: SelectOption[] = EQUIPMENT_KEYS.map((k) => ({
    key: k,
    label: t(`equipment.${k}`),
  }));

  const togglePrimary = (key: string) => {
    const muscle = key as MuscleEnum;
    setPrimaryMuscles((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle],
    );
    // Remove from secondary if selected as primary
    setSecondaryMuscles((prev) => prev.filter((m) => m !== muscle));
    if (primaryError) setPrimaryError(null);
  };

  const toggleSecondary = (key: string) => {
    const muscle = key as MuscleEnum;
    // Can't be both primary and secondary
    if (primaryMuscles.includes(muscle)) return;
    setSecondaryMuscles((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle],
    );
  };

  const validate = (): boolean => {
    let valid = true;
    if (!name.trim()) {
      setNameError(t('create_exercise.error_name_required'));
      valid = false;
    } else {
      setNameError(null);
    }
    if (primaryMuscles.length === 0) {
      setPrimaryError(t('create_exercise.error_primary_required'));
      valid = false;
    } else {
      setPrimaryError(null);
    }
    return valid;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!db || !session?.user?.id) return;

    setSaving(true);
    try {
      const id = createCustomExercise(db, {
        name,
        category,
        isBodyweight,
        instructions: instructions.trim() || null,
        primaryMuscles,
        secondaryMuscles,
        userId: session.user.id,
      });
      router.replace(`/catalog/${id}`);
    } catch {
      Alert.alert(t('common.error_generic'), t('create_exercise.error_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header">
            {t('create_exercise.title')}
          </Text>
          <Pressable
            onPress={handleSave}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={t('create_exercise.save_button')}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={styles.saveText}>{t('create_exercise.save_button')}</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('create_exercise.name_label')}</Text>
            <TextInput
              style={[styles.textInput, nameError ? styles.inputError : null]}
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (nameError) setNameError(null);
              }}
              placeholder={t('create_exercise.name_placeholder')}
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
              returnKeyType="next"
              accessibilityLabel={t('create_exercise.name_label')}
            />
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('create_exercise.category_label')}</Text>
            <View style={styles.chipRow}>
              {equipmentOptions.map((opt) => {
                const isActive = category === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      const eq = opt.key as EquipmentEnum;
                      setCategory(eq);
                      // Bodyweight category chip also activates the isBodyweight flag
                      if (eq === 'bodyweight') setIsBodyweight(true);
                    }}
                    style={({ pressed }) => [
                      styles.singleChip,
                      isActive && styles.singleChipActive,
                      pressed && { opacity: 0.75 },
                    ]}
                    accessibilityRole="radio"
                    accessibilityLabel={opt.label}
                    accessibilityState={{ checked: isActive }}
                  >
                    <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Primary muscles */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('create_exercise.primary_muscles_label')}</Text>
            <MultiSelect
              options={muscleOptions}
              selected={primaryMuscles}
              onToggle={togglePrimary}
              accessibilityLabel={t('create_exercise.primary_muscles_label')}
            />
            {primaryError ? <Text style={styles.errorText}>{primaryError}</Text> : null}
          </View>

          {/* Secondary muscles */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('create_exercise.secondary_muscles_label')}</Text>
            <MultiSelect
              options={muscleOptions.filter((o) => !primaryMuscles.includes(o.key as MuscleEnum))}
              selected={secondaryMuscles}
              onToggle={toggleSecondary}
              accessibilityLabel={t('create_exercise.secondary_muscles_label')}
            />
          </View>

          {/* Bodyweight toggle */}
          <View style={styles.switchField}>
            <View style={styles.switchText}>
              <Text style={styles.label}>{t('create_exercise.bodyweight_label')}</Text>
              <Text style={styles.hint}>{t('create_exercise.bodyweight_hint')}</Text>
            </View>
            <Switch
              value={isBodyweight}
              onValueChange={setIsBodyweight}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.onAccent}
              accessibilityLabel={t('create_exercise.bodyweight_label')}
              accessibilityRole="switch"
              accessibilityState={{ checked: isBodyweight }}
            />
          </View>

          {/* Instructions */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('create_exercise.instructions_label')}</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={instructions}
              onChangeText={setInstructions}
              placeholder={t('create_exercise.instructions_placeholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessibilityLabel={t('create_exercise.instructions_label')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
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
  saveText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '500',
    textAlign: 'right',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: {
    ...typography.label,
    color: colors.textTertiary,
    marginTop: 2,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
    minHeight: TOUCH_TARGET,
  },
  inputError: {
    borderColor: colors.error,
  },
  textArea: {
    minHeight: 96,
    paddingTop: spacing.md,
  },
  errorText: {
    ...typography.label,
    color: colors.error,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  singleChip: {
    minHeight: TOUCH_TARGET - 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipLabel: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 13,
  },
  chipLabelActive: {
    color: colors.onAccent,
    fontWeight: '500',
  },
  switchField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    minHeight: TOUCH_TARGET,
  },
  switchText: {
    flex: 1,
    gap: spacing.xs,
  },
});
