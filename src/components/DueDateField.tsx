import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';
import { formatDateKey, fromDateKey, toDateKey } from '@/utils/date';

export type DueDateFieldProps = {
  value: string | null;
  todayKey: string;
  onChange: (value: string | null) => void;
  /** 「解除」ボタンを出すか（既定 true）。必須の日付では false にする */
  clearable?: boolean;
  /** 読み上げ用の項目名（既定「期限」） */
  label?: string;
};

/**
 * 期限の入力欄。
 * Android は OS 標準の日付ダイアログ、iOS は欄の下にカレンダーを開く。
 */
export function DueDateField({
  value,
  todayKey,
  onChange,
  clearable = true,
  label = '期限',
}: DueDateFieldProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const pickerDate = fromDateKey(value ?? todayKey);

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: pickerDate,
        mode: 'date',
        onValueChange: (_event, date) => onChange(toDateKey(date)),
      });
      return;
    }
    // iOS: 未設定のまま開いた場合は、カレンダーに表示される今日を選択値にする
    if (!isPickerOpen && value === null) onChange(todayKey);
    setIsPickerOpen((open) => !open);
  };

  const clear = () => {
    setIsPickerOpen(false);
    onChange(null);
  };

  return (
    <View>
      <View style={styles.row}>
        <Pressable
          onPress={openPicker}
          accessibilityRole="button"
          accessibilityLabel={
            value ? `${label} ${formatDateKey(value, todayKey)}。変更する` : `${label}を設定`
          }
          style={({ pressed }) => [styles.field, pressed && styles.pressed]}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          <Text style={[styles.value, value === null && styles.placeholder]}>
            {value ? formatDateKey(value, todayKey) : '期限なし'}
          </Text>
        </Pressable>
        {clearable && value !== null ? (
          <Pressable
            onPress={clear}
            accessibilityRole="button"
            accessibilityLabel={`${label}を解除`}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {Platform.OS === 'ios' && isPickerOpen ? (
        <View style={styles.picker}>
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="inline"
            locale="ja-JP"
            themeVariant="light"
            accentColor={colors.primary}
            onValueChange={(_event, date) => onChange(toDateKey(date))}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  field: {
    flex: 1,
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  value: { fontSize: fontSize.body, color: colors.text },
  placeholder: { color: colors.textMuted },
  clear: {
    width: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.6 },
  picker: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
});
