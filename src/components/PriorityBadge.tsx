import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/theme';
import { PRIORITY_LABELS, type Priority } from '@/types/task';

export const PRIORITY_COLORS: Record<Priority, string> = {
  high: colors.priorityHigh,
  medium: colors.priorityMedium,
  low: colors.priorityLow,
};

export function PriorityBadge({ priority, muted }: { priority: Priority; muted?: boolean }) {
  const color = muted ? colors.textMuted : PRIORITY_COLORS[priority];
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>優先度 {PRIORITY_LABELS[priority]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: fontSize.caption, fontWeight: '600' },
});
