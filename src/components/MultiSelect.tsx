/**
 * MultiSelect — a grid of toggle chips for picking multiple values.
 * Each chip is a Pressable with an accessibilityState checked indicator.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';

export interface SelectOption {
  key: string;
  label: string;
}

type Props = {
  options: SelectOption[];
  selected: string[];
  onToggle: (key: string) => void;
  accessibilityLabel?: string;
};

export function MultiSelect({ options, selected, onToggle, accessibilityLabel }: Props) {
  return (
    <View style={styles.grid} accessibilityLabel={accessibilityLabel}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt.key);
        return (
          <Pressable
            key={opt.key}
            onPress={() => onToggle(opt.key)}
            style={({ pressed }) => [
              styles.chip,
              isSelected && styles.chipSelected,
              pressed && styles.chipPressed,
            ]}
            accessibilityRole="checkbox"
            accessibilityLabel={opt.label}
            accessibilityState={{ checked: isSelected }}
          >
            <Text style={[styles.label, isSelected && styles.labelSelected]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
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
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipPressed: {
    opacity: 0.75,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 13,
  },
  labelSelected: {
    color: colors.onAccent,
    fontWeight: '500',
  },
});
