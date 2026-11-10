import { StyleSheet, Text, View } from 'react-native';

import { cardShadow, colors, fontSize, radius, spacing } from '@/theme';
import { formatYen, type MonthSummary } from '@/utils/ledger';

/** 月の支出合計・収入合計・収支。 */
export function LedgerSummaryCard({ summary }: { summary: MonthSummary }) {
  // 符号と金額を 1 つの文字列にして、途中で改行されないようにする
  const balanceText = `${summary.balance > 0 ? '+' : ''}${formatYen(summary.balance)}`;
  return (
    <View style={styles.card}>
      <Text style={styles.caption}>支出</Text>
      <Text style={styles.expense} accessibilityLabel={`支出 ${formatYen(summary.expense)}`}>
        {formatYen(summary.expense)}
      </Text>
      <View style={styles.row}>
        <View style={styles.item}>
          <Text style={styles.caption}>収入</Text>
          <Text style={styles.value} accessibilityLabel={`収入 ${formatYen(summary.income)}`}>
            {formatYen(summary.income)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.item}>
          <Text style={styles.caption}>収支</Text>
          <Text style={styles.value} accessibilityLabel={`収支 ${balanceText}`}>
            {balanceText}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.xs,
    ...cardShadow,
  },
  caption: { fontSize: fontSize.caption, fontWeight: '600', color: '#D5D9FA' },
  expense: { fontSize: 36, fontWeight: '800', color: colors.onPrimary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  item: { flex: 1, gap: 2 },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: spacing.md,
  },
  value: { fontSize: fontSize.subtitle, fontWeight: '700', color: colors.onPrimary },
});
