import { StyleSheet, Text, View } from 'react-native';

import { useTasks } from '@/context/TaskContext';
import { colors, fontSize, radius, spacing } from '@/theme';

/** データの読み込み・保存に失敗したときだけ表示する。 */
export function StorageErrorBanner() {
  const { storageError } = useTasks();
  if (!storageError) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>{storageError}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  text: { fontSize: fontSize.caption, lineHeight: 20, color: colors.danger },
});
