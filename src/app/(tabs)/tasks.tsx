import { ScrollView, StyleSheet, View } from 'react-native';

import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, spacing } from '@/theme';

export default function TasksScreen() {
  return (
    <View style={styles.screen}>
      <ScreenHeader title="タスク一覧" />
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState
          icon="file-tray-outline"
          title="タスクはまだありません"
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
});
