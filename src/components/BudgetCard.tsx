import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cardShadow, colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';
import { formatYen, getBudgetStatus } from '@/utils/ledger';

type Props = {
  /** 1 か月の支出予算。未設定は null */
  budget: number | null;
  /** その月の支出合計 */
  spent: number;
};

/** 予算に対する使用状況。未設定なら設定への導線を出す。 */
export function BudgetCard({ budget, spent }: Props) {
  const openEditor = () => router.push('/budget-editor');

  if (budget === null) {
    return (
      <Pressable
        onPress={openEditor}
        accessibilityRole="button"
        accessibilityLabel="予算を設定"
        style={({ pressed }) => [styles.card, styles.empty, pressed && styles.pressed]}
      >
        <Ionicons name="wallet-outline" size={22} color={colors.primary} />
        <Text style={styles.emptyText}>1 か月の予算を設定する</Text>
      </Pressable>
    );
  }

  const status = getBudgetStatus(budget, spent);
  const barColor = status.isOver
    ? colors.danger
    : status.ratio >= 0.8
      ? colors.warning
      : colors.success;
  const percent = Math.round(status.ratio * 100);

  return (
    <Pressable
      onPress={openEditor}
      accessibilityRole="button"
      accessibilityLabel={`予算 ${formatYen(budget)}。${
        status.isOver
          ? `${formatYen(-status.remaining)} 超過`
          : `残り ${formatYen(status.remaining)}`
      }。予算を変更する`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>予算 {formatYen(budget)}</Text>
        <Ionicons name="create-outline" size={18} color={colors.textMuted} />
      </View>
      <Text style={[styles.remaining, status.isOver && styles.over]}>
        {status.isOver
          ? `${formatYen(-status.remaining)} 超過`
          : `残り ${formatYen(status.remaining)}`}
      </Text>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.min(percent, 100) }}
      >
        <View
          style={[styles.fill, { width: `${Math.min(percent, 100)}%`, backgroundColor: barColor }]}
        />
      </View>
      <Text style={styles.percent}>{percent}% 使用</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    ...cardShadow,
  },
  pressed: { opacity: 0.7 },
  empty: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyText: { fontSize: fontSize.body, fontWeight: '600', color: colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: fontSize.caption, fontWeight: '600', color: colors.textSecondary },
  remaining: { fontSize: fontSize.title, fontWeight: '700', color: colors.text },
  over: { color: colors.danger },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
  percent: { fontSize: fontSize.caption, color: colors.textSecondary, textAlign: 'right' },
});
