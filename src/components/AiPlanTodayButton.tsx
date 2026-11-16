import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';

/** 「今日やることの提案」画面を開くボタン。AI 機能を使える状態（ログイン中）のときだけ表示する */
export function AiPlanTodayButton() {
  const { isAvailable, session } = useAuth();
  if (!isAvailable || !session) return null;
  return (
    <Pressable
      onPress={() => router.push('/ai-plan')}
      accessibilityRole="button"
      accessibilityLabel="AI に今日やることを提案してもらう"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="bulb-outline" size={18} color={colors.primary} />
      <Text style={styles.label} numberOfLines={1}>
        AI に今日やることを提案してもらう
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.7 },
  label: { flexShrink: 1, fontSize: fontSize.body, fontWeight: '700', color: colors.primary },
});
