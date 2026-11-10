import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, MIN_TOUCH, spacing } from '@/theme';
import { ENTRY_TYPE_LABELS, getCategoryInfo, type LedgerEntry } from '@/types/ledger';
import { formatYen } from '@/utils/ledger';

type Props = {
  entry: LedgerEntry;
  onPress: (id: string) => void;
};

/** 家計簿の 1 件。タップで編集画面を開く。 */
export function LedgerEntryItem({ entry, onPress }: Props) {
  const category = getCategoryInfo(entry.category);
  const isIncome = entry.type === 'income';
  const amountText = `${isIncome ? '+' : '-'}${formatYen(entry.amount)}`;

  return (
    <Pressable
      onPress={() => onPress(entry.id)}
      accessibilityRole="button"
      accessibilityLabel={`${ENTRY_TYPE_LABELS[entry.type]} ${category.label} ${formatYen(
        entry.amount,
      )}${entry.note ? `、${entry.note}` : ''}。編集する`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: category.color }]}>
        <Text style={styles.iconText}>{category.label.slice(0, 1)}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.category}>{category.label}</Text>
        {entry.note ? (
          <Text style={styles.note} numberOfLines={1}>
            {entry.note}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.amount, isIncome && styles.income]}>{amountText}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.6 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 15, fontWeight: '700', color: colors.onPrimary },
  body: { flex: 1, gap: 2 },
  category: { fontSize: fontSize.body, fontWeight: '600', color: colors.text },
  note: { fontSize: fontSize.caption, color: colors.textSecondary },
  amount: { fontSize: fontSize.body, fontWeight: '700', color: colors.text },
  income: { color: colors.success },
});
