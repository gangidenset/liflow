import { StyleSheet, Text, View } from 'react-native';

import { cardShadow, colors, fontSize, radius, spacing } from '@/theme';
import { formatYen, type CategoryTotal } from '@/utils/ledger';

/** 支出のカテゴリ別内訳（金額と割合の横棒）。 */
export function CategoryBreakdown({ totals }: { totals: CategoryTotal[] }) {
  if (totals.length === 0) return null;
  return (
    <View style={styles.card}>
      {totals.map(({ category, amount, ratio }) => {
        const percent = Math.round(ratio * 100);
        return (
          <View
            key={category.key}
            style={styles.row}
            accessible
            accessibilityLabel={`${category.label} ${formatYen(amount)}、${percent}%`}
          >
            <View style={styles.labelRow}>
              <View style={[styles.dot, { backgroundColor: category.color }]} />
              <Text style={styles.label}>{category.label}</Text>
              <Text style={styles.amount}>{formatYen(amount)}</Text>
              <Text style={styles.percent}>{percent}%</Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  // 割合が小さくても見えるように最低幅を持たせる
                  { width: `${Math.max(ratio * 100, 2)}%`, backgroundColor: category.color },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    ...cardShadow,
  },
  row: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { flex: 1, fontSize: 15, color: colors.text },
  amount: { fontSize: 15, fontWeight: '600', color: colors.text },
  percent: {
    width: 44,
    textAlign: 'right',
    fontSize: fontSize.caption,
    color: colors.textSecondary,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
