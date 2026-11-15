import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'link';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** 処理中は押せなくし、くるくるを出す */
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/** 画面共通のボタン。 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-disabled={isDisabled}
      aria-busy={loading}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.primary} />
      ) : (
        <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.dangerSoft },
  link: { minHeight: MIN_TOUCH },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  label: { fontSize: fontSize.body, fontWeight: '700' },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.onPrimary },
  secondary: { color: colors.primary },
  danger: { color: colors.danger },
  link: { color: colors.primary, fontWeight: '600' },
});
