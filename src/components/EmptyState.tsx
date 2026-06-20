import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/lib/theme';
import { Button } from './Button';

type Action = { label: string; onPress: () => void };

type Props = {
  message: string;
  /** Optional primary CTA rendered below the message. */
  primaryAction?: Action;
  /** Optional secondary CTA rendered below the primary one. */
  secondaryAction?: Action;
};

export function EmptyState({ message, primaryAction, secondaryAction }: Props) {
  return (
    <View style={styles.container}>
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
