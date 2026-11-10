import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';
import type { TaskFilter } from '@/types/task';

const FILTERS: readonly { key: TaskFilter; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'active', label: '未完了' },
  { key: 'completed', label: '完了済み' },
];

type Props = {
  value: TaskFilter;
  counts: Record<TaskFilter, number>;
  onChange: (filter: TaskFilter) => void;
};

export function FilterTabs({ value, counts, onChange }: Props) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {FILTERS.map(({ key, label }) => {
        const selected = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label} ${counts[key]}件`}
            style={[styles.tab, selected && styles.tabSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
            <Text style={[styles.count, selected && styles.labelSelected]}>{counts[key]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    minHeight: MIN_TOUCH - 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md - 2,
  },
  tabSelected: { backgroundColor: colors.surface },
  label: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  count: { fontSize: fontSize.caption, fontWeight: '600', color: colors.textMuted },
  labelSelected: { color: colors.primary },
});
