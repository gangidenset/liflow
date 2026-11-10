import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRIORITY_COLORS, PriorityBadge } from '@/components/PriorityBadge';
import { cardShadow, colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';
import type { Task } from '@/types/task';
import { formatDueLabel, getDueStatus, type DueStatus } from '@/utils/date';

type Props = {
  task: Task;
  todayKey: string;
  onToggle: (id: string) => void;
  onPress: (id: string) => void;
};

const DUE_STYLES: Record<DueStatus, { text: string; background: string; emphasized: boolean }> = {
  overdue: { text: colors.danger, background: colors.dangerSoft, emphasized: true },
  today: { text: colors.warning, background: colors.warningSoft, emphasized: true },
  tomorrow: { text: colors.warning, background: colors.warningSoft, emphasized: true },
  later: { text: colors.textSecondary, background: colors.background, emphasized: false },
};

export function TaskItem({ task, todayKey, onToggle, onPress }: Props) {
  const { completed } = task;
  // 完了済みのタスクは期限の強調をしない
  const dueStatus: DueStatus | null =
    task.dueDate === null ? null : completed ? 'later' : getDueStatus(task.dueDate, todayKey);
  const due = dueStatus ? DUE_STYLES[dueStatus] : null;

  return (
    <View style={[styles.card, completed && styles.cardCompleted]}>
      <View
        style={[
          styles.priorityBar,
          { backgroundColor: completed ? colors.border : PRIORITY_COLORS[task.priority] },
        ]}
      />
      <Pressable
        onPress={() => onToggle(task.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
        accessibilityLabel={`${task.title}を${completed ? '未完了に戻す' : '完了にする'}`}
        hitSlop={4}
        style={styles.checkArea}
      >
        <Ionicons
          name={completed ? 'checkmark-circle' : 'ellipse-outline'}
          size={30}
          color={completed ? colors.success : colors.textMuted}
        />
      </Pressable>
      <Pressable
        onPress={() => onPress(task.id)}
        accessibilityRole="button"
        accessibilityLabel={`${task.title}を編集`}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        <Text style={[styles.title, completed && styles.titleCompleted]} numberOfLines={2}>
          {task.title}
        </Text>
        {task.note ? (
          <Text style={styles.note} numberOfLines={1}>
            {task.note}
          </Text>
        ) : null}
        <View style={styles.meta}>
          <PriorityBadge priority={task.priority} muted={completed} />
          {task.dueDate && due ? (
            <View style={[styles.due, { backgroundColor: due.background }]}>
              <Ionicons
                name={dueStatus === 'overdue' ? 'alert-circle' : 'calendar-outline'}
                size={14}
                color={due.text}
              />
              <Text style={[styles.dueLabel, { color: due.text }, due.emphasized && styles.bold]}>
                {formatDueLabel(task.dueDate, todayKey)}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...cardShadow,
  },
  cardCompleted: { opacity: 0.75 },
  priorityBar: { width: 5 },
  checkArea: {
    width: MIN_TOUCH + spacing.xs,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
    gap: spacing.xs,
  },
  pressed: { opacity: 0.6 },
  title: {
    fontSize: fontSize.body,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.text,
  },
  titleCompleted: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  note: { fontSize: fontSize.caption, color: colors.textSecondary },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  due: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  dueLabel: { fontSize: fontSize.caption },
  bold: { fontWeight: '700' },
});
