import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';

/** 「AI で追加」画面を開くボタン。AI 機能を使える状態（ログイン中）のときだけ表示する */
export function AiQuickAddButton() {
  const { isAvailable, session } = useAuth();
  if (!isAvailable || !session) return null;
  return (
    <Pressable
      onPress={() => router.push('/ai-add')}
      accessibilityRole="button"
      accessibilityLabel="AI で追加"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="sparkles" size={18} color={colors.primary} />
      <Text style={styles.label}>AI で追加</Text>
      <Text style={styles.hint} numberOfLines={1}>
        文章からタスク・家計簿を作成
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.7 },
  label: { fontSize: fontSize.body, fontWeight: '700', color: colors.primary },
  hint: { flexShrink: 1, fontSize: fontSize.caption, color: colors.primary },
});
