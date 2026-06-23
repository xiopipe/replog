/**
 * EmptyState — illustrated placeholder for empty lists and missing content.
 *
 * TKT-0051: Accepts an optional `icon` prop (Ionicons name) to show a simple
 * icon-based illustration above the message text. Uses the existing icon set;
 * no third-party assets or Lottie.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, typography } from '@/lib/theme';
import { Button } from './Button';

type Action = { label: string; onPress: () => void };

type Props = {
  message: string;
  /** Optional Ionicons name for the illustration icon. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Optional primary CTA rendered below the message. */
  primaryAction?: Action;
  /** Optional secondary CTA rendered below the primary one. */
  secondaryAction?: Action;
};

export function EmptyState({ message, icon, primaryAction, secondaryAction }: Props) {
  return (
    <View style={styles.container}>
      {icon ? (
        <View style={styles.iconWrapper}>
          <Ionicons name={icon} size={56} color={colors.textTertiary} />
        </View>
      ) : null}
      <Text style={styles.text}>{message}</Text>
      {primaryAction || secondaryAction ? (
        <View style={styles.actions}>
          {primaryAction ? (
            <Button label={primaryAction.label} onPress={primaryAction.onPress} />
          ) : null}
          {secondaryAction ? (
            <Button
              label={secondaryAction.label}
              onPress={secondaryAction.onPress}
              variant="secondary"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconWrapper: {
    opacity: 0.5,
    marginBottom: spacing.sm,
  },
  text: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
});
