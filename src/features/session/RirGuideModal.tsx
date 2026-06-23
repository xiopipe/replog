/**
 * RirGuideModal — TKT-0046
 *
 * Non-blocking bottom-sheet that shows the RPE ↔ RIR equivalence table.
 * Triggered by a small ⓘ icon next to the RIR/RPE stepper.
 * Uses a plain Modal so we introduce no new library.
 */

import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing, typography, TOUCH_TARGET } from '@/lib/theme';

interface RirGuideModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function RirGuideModal({ visible, onDismiss }: RirGuideModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityLabel={t('common.cancel')} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{t('session.rir_guide_title')}</Text>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.guideText}>{t('session.rir_guide_body')}</Text>
        </ScrollView>
        <Pressable
          style={styles.closeButton}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        >
          <Text style={styles.closeText}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '60%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.section,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  guideText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  closeButton: {
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  closeText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '500',
  },
});
