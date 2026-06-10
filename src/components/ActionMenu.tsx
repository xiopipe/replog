/**
 * ActionMenu — a bottom-sheet action menu (Modal based).
 *
 * Replaces the platform Alert/ActionSheet for menus with more than a couple of
 * options. The native Android `Alert` only renders three buttons (positive /
 * negative / neutral), so longer menus silently lose options — and the cancel
 * button along with them. This Modal shows every option, is always dismissible
 * (tap the scrim or the explicit cancel row), and matches the dark theme.
 *
 * Accessibility: each row is a button with a label; the scrim is labelled as a
 * dismiss control.
 */

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';

export interface ActionMenuOption {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

export interface ActionMenuProps {
  visible: boolean;
  title?: string;
  options: ActionMenuOption[];
  onClose: () => void;
}

export function ActionMenu({ visible, title, options, onClose }: ActionMenuProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      >
        {/* Stop propagation: taps inside the sheet must not dismiss. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {options.map((opt, i) => (
            <Pressable
              key={i}
              style={styles.row}
              onPress={() => {
                onClose();
                opt.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
            >
              <Text style={[styles.rowText, opt.destructive && styles.rowTextDestructive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.row, styles.cancelRow]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  title: {
    ...typography.label,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  row: {
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowText: {
    ...typography.section,
    color: colors.textPrimary,
  },
  rowTextDestructive: {
    color: colors.error,
  },
  cancelRow: {
    marginTop: spacing.sm,
  },
  cancelText: {
    ...typography.section,
    color: colors.textSecondary,
  },
});
