import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';

export interface ChipOption {
  key: string;
  label: string;
}

type Props = {
  options: ChipOption[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  accessibilityLabel?: string;
};

export function FilterChips({ options, selected, onSelect, accessibilityLabel }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="menu"
    >
      {options.map((opt) => {
        const isActive = selected === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onSelect(isActive ? null : opt.key)}
            style={({ pressed }) => [
              styles.chip,
              isActive && styles.chipActive,
              pressed && styles.chipPressed,
            ]}
            accessibilityRole="menuitem"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  chip: {
    minHeight: TOUCH_TARGET - 8, // slightly smaller within list, still ≥36
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
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
  labelActive: {
    color: colors.onAccent,
    fontWeight: '500',
  },
});
