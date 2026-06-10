/**
 * Retroactive session — create a past-dated workout.
 *
 * Route: /session/retroactive  (Stack route)
 *
 * Lets the user pick a date/time in the past via @react-native-community/datetimepicker,
 * then calls createRetroactiveSession → navigates to the session screen.
 */

import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { openAndroidDateTime } from '@/lib/datetime-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';
import { createRetroactiveSession } from '@/features/session/mutations';

export default function RetroactiveSessionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { db, session } = useAuth();

  const [date, setDate] = useState(new Date());
  const [name, setName] = useState('');
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');

  const handleDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (selected) setDate(selected);
  };

  const openPicker = () => {
    if (Platform.OS === 'ios') {
      setShowPicker(true);
      return;
    }
    openAndroidDateTime({ value: date, maximumDate: new Date(), onConfirm: setDate });
  };

  const handleStart = () => {
    if (!db || !session?.user?.id) return;

    const sessionId = createRetroactiveSession(db, session.user.id, {
      startedAt: date.toISOString(),
      name: name.trim() || undefined,
    });

    router.replace(`/session/${sessionId}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
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
          {t('session.retroactive_title')}
        </Text>
      </View>

      <View style={styles.content}>
        {/* Name */}
        <Text style={styles.fieldLabel}>{t('session.retroactive_name_placeholder')}</Text>
        <TextInput
          style={styles.textInput}
          value={name}
          onChangeText={setName}
          placeholder={t('session.retroactive_name_placeholder')}
          placeholderTextColor={colors.textTertiary}
          returnKeyType="done"
          accessibilityLabel={t('session.retroactive_name_placeholder')}
        />

        {/* Date picker */}
        <Text style={styles.fieldLabel}>{t('session.retroactive_date_label')}</Text>

        {Platform.OS === 'android' && (
          <Pressable
            onPress={openPicker}
            style={styles.dateButton}
            accessibilityRole="button"
            accessibilityLabel={t('session.retroactive_date_label')}
          >
            <Text style={styles.dateButtonText}>{date.toLocaleString()}</Text>
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
          </Pressable>
        )}

        {/* iOS: inline component. Android uses the imperative picker (openPicker). */}
        {Platform.OS === 'ios' && showPicker && (
          <DateTimePicker
            value={date}
            mode="datetime"
            display="inline"
            maximumDate={new Date()}
            onChange={handleDateChange}
            themeVariant="dark"
          />
        )}

        {/* Start button */}
        <Pressable
          onPress={handleStart}
          style={styles.startButton}
          accessibilityRole="button"
          accessibilityLabel={t('session.retroactive_start')}
        >
          <Text style={styles.startButtonText}>{t('session.retroactive_start')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
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
  title: { ...typography.title, color: colors.textPrimary, flex: 1 },

  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },

  fieldLabel: { ...typography.label, color: colors.textSecondary },

  textInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: TOUCH_TARGET,
  },

  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: TOUCH_TARGET,
  },
  dateButtonText: { ...typography.body, color: colors.textPrimary },

  startButton: {
    minHeight: TOUCH_TARGET + 4,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  startButtonText: { ...typography.section, color: colors.onAccent, fontSize: 15 },
});
