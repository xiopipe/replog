/**
 * ReorderExercisesModal — TKT-0020
 *
 * A Modal with a DraggableFlatList of the current session's exercises.
 * On confirm → batch-updates session_exercises.order_index.
 * On cancel → restores previous order in local state; persists nothing.
 *
 * Uses the same DraggableFlatList lib as app/routines/editor.tsx for consistency.
 */

import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';
import type { SessionExerciseRow, ExerciseRow } from '@/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReorderItem {
  se: SessionExerciseRow;
  exercise: ExerciseRow | null;
}

interface Props {
  visible: boolean;
  items: ReorderItem[];
  onConfirm: (orderedIds: string[]) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReorderExercisesModal({ visible, items, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();

  // Local draft order — initialised from items on each open
  const [draft, setDraft] = useState<ReorderItem[]>(items);

  // When items change (e.g. modal re-opened), reset draft.
  // Use key remount pattern on the DraggableFlatList instead of effect.

  const handleConfirm = useCallback(() => {
    onConfirm(draft.map((d) => d.se.id));
  }, [draft, onConfirm]);

  const handleCancel = useCallback(() => {
    // Reset draft to original order so next open is clean
    setDraft(items);
    onCancel();
  }, [items, onCancel]);

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ReorderItem>) => (
      <Pressable
        onLongPress={drag}
        style={[styles.row, isActive && styles.rowActive]}
        accessibilityRole="button"
        accessibilityLabel={t('session.reorder_drag_hint', {
          name: item.exercise?.name ?? item.se.exercise_id,
        })}
      >
        <Ionicons
          name="menu-outline"
          size={22}
          color={colors.textTertiary}
          style={styles.dragHandle}
        />
        <Text style={styles.exerciseName} numberOfLines={1}>
          {item.exercise?.name ?? item.se.exercise_id}
        </Text>
      </Pressable>
    ),
    [t],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={handleCancel}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.headerBtnText}>{t('common.cancel')}</Text>
            </Pressable>
            <Text style={styles.title}>{t('session.reorder_title')}</Text>
            <Pressable
              onPress={handleConfirm}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
            >
              <Text style={[styles.headerBtnText, styles.headerBtnPrimary]}>
                {t('common.save')}
              </Text>
            </Pressable>
          </View>

          {/* Drag hint */}
          <Text style={styles.hint}>{t('session.reorder_hint')}</Text>

          {/* Draggable list — key forces remount when items changes so draft syncs */}
          <DraggableFlatList
            key={items.map((i) => i.se.id).join(',')}
            data={draft}
            keyExtractor={(item) => item.se.id}
            renderItem={renderItem}
            onDragEnd={({ data }) => setDraft(data)}
            containerStyle={styles.list}
            activationDistance={5}
          />
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
    maxHeight: '75%',
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    minWidth: 72,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
  },
  headerBtnText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 15,
  },
  headerBtnPrimary: {
    color: colors.accent,
    fontWeight: '600',
    textAlign: 'right',
  },
  title: {
    flex: 1,
    ...typography.section,
    color: colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
  },
  hint: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  list: {
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET + 4,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowActive: {
    backgroundColor: colors.surfaceAlt,
    opacity: 0.9,
  },
  dragHandle: {
    padding: spacing.xs,
  },
  exerciseName: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 15,
  },
});
