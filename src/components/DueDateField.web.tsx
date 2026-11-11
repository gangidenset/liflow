import { createElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';

import type { DueDateFieldProps } from './DueDateField';

/**
 * Web（開発時のブラウザ確認用）の期限入力欄。
 * ネイティブの日付ピッカーは Web で動作しないため、ブラウザ標準の日付入力を使う。
 */
export function DueDateField({
  value,
  onChange,
  clearable = true,
  label = '期限',
}: DueDateFieldProps) {
  return (
    <View style={styles.row}>
      {createElement('input', {
        type: 'date',
        value: value ?? '',
        'aria-label': label,
        // 必須の日付では空にできないようにする
        required: !clearable,
        onChange: (event: { target: { value: string } }) => {
          const next = event.target.value || null;
          if (next === null && !clearable) return;
          onChange(next);
        },
        style: {
          flex: 1,
          minHeight: MIN_TOUCH,
          boxSizing: 'border-box',
          fontSize: fontSize.body,
          fontFamily: 'inherit',
          color: colors.text,
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          padding: `0 ${spacing.lg}px`,
        },
      })}
      {clearable && value !== null ? (
        <Pressable onPress={() => onChange(null)} accessibilityRole="button" style={styles.clear}>
          <Text style={styles.clearLabel}>解除</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  clear: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  clearLabel: { fontSize: fontSize.body, color: colors.textSecondary },
});
