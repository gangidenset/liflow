import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { cardShadow, colors, radius, spacing } from '@/theme';

/** 画面右下に固定表示するタスク追加ボタン。 */
export function AddButton() {
  return (
    <Pressable
      onPress={() => router.push('/task-editor')}
      accessibilityRole="button"
      accessibilityLabel="タスクを追加"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="add" size={32} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
    elevation: 6,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});
