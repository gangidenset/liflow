import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fontSize, spacing } from '@/theme';
import { formatFullDate } from '@/utils/date';

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <ScreenHeader title="今日" subtitle={formatFullDate(new Date())} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>今日のタスク</Text>
        <EmptyState
          icon="sunny-outline"
          title="今日のタスクはありません"
          message="右下の＋ボタンからタスクを追加できます"
        />
      </ScrollView>
      <AddButton />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 110,
  },
  sectionTitle: {
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
});
