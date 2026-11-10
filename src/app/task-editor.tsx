import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';

/** タスクの新規登録・編集画面。入力フォームは STEP 4 で実装する。 */
export default function TaskEditorScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom + spacing.lg }]}>
      <Text style={styles.note}>入力フォームは次の工程（STEP 4）で実装します。</Text>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonLabel}>閉じる</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  note: {
    fontSize: fontSize.body,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  button: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  buttonLabel: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
