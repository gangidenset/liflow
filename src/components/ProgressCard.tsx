import { StyleSheet, Text, View } from 'react-native';

import { cardShadow, colors, fontSize, radius, spacing } from '@/theme';

type Props = {
  completedCount: number;
  activeCount: number;
};

/** 今日のタスクの進捗率と完了数・未完了数。 */
export function ProgressCard({ completedCount, activeCount }: Props) {
  const total = completedCount + activeCount;
  const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.caption}>今日の進捗</Text>
          <Text style={styles.percent}>
            {percent}
            <Text style={styles.percentUnit}>%</Text>
          </Text>
        </View>
        <View style={styles.counts}>
          <Count label="完了" value={completedCount} />
          <View style={styles.divider} />
          <Count label="未完了" value={activeCount} />
        </View>
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
      >
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.count}>
      <Text style={styles.countValue}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    ...cardShadow,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  caption: { fontSize: fontSize.caption, fontWeight: '600', color: '#D5D9FA' },
  percent: { fontSize: 44, fontWeight: '800', color: colors.onPrimary },
  percentUnit: { fontSize: fontSize.subtitle, fontWeight: '700' },
  counts: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingBottom: spacing.sm },
  divider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.3)' },
  count: { alignItems: 'center', minWidth: 44 },
  countValue: { fontSize: fontSize.title, fontWeight: '700', color: colors.onPrimary },
  countLabel: { fontSize: fontSize.caption, color: '#D5D9FA' },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.onPrimary },
});
