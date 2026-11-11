import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';
import { formatMonth, shiftMonth } from '@/utils/ledger';

type Props = {
  monthKey: string;
  currentMonthKey: string;
  onChange: (monthKey: string) => void;
};

/** 表示する月を前後に切り替える。今月以外を表示中は「今月」に戻るボタンを出す。 */
export function MonthSwitcher({ monthKey, currentMonthKey, onChange }: Props) {
  const isCurrent = monthKey === currentMonthKey;
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(shiftMonth(monthKey, -1))}
        accessibilityRole="button"
        accessibilityLabel="前の月"
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
      </Pressable>
      <View style={styles.center}>
        <Text style={styles.month} accessibilityRole="header">
          {formatMonth(monthKey)}
        </Text>
        {isCurrent ? null : (
          <Pressable
            onPress={() => onChange(currentMonthKey)}
            accessibilityRole="button"
            accessibilityLabel="今月に戻る"
            hitSlop={8}
          >
            <Text style={styles.today}>今月に戻る</Text>
          </Pressable>
        )}
      </View>
      <Pressable
        onPress={() => onChange(shiftMonth(monthKey, 1))}
        accessibilityRole="button"
        accessibilityLabel="次の月"
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-forward" size={24} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xs,
  },
  arrow: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.5 },
  center: { alignItems: 'center', gap: 2, paddingVertical: spacing.xs },
  month: { fontSize: fontSize.subtitle, fontWeight: '700', color: colors.text },
  today: { fontSize: fontSize.caption, fontWeight: '600', color: colors.primary },
});
