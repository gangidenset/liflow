import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLedger } from '@/context/LedgerContext';
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';
import { parseAmount, sanitizeAmountInput } from '@/utils/ledger';

/** 1 か月の支出予算の設定画面。毎月共通の金額を 1 つ設定する。 */
export default function BudgetEditorScreen() {
  const { budget, isLoaded, setBudget } = useLedger();
  if (!isLoaded) {
    return (
      <View style={styles.screen}>
        <Text style={styles.description}>読み込み中…</Text>
      </View>
    );
  }
  return <BudgetForm initial={budget} onSave={setBudget} />;
}

function BudgetForm({
  initial,
  onSave,
}: {
  initial: number | null;
  onSave: (budget: number | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const [amountText, setAmountText] = useState(initial === null ? '' : String(initial));
  const [showError, setShowError] = useState(false);

  const save = () => {
    const amount = parseAmount(amountText);
    if (amount === null) {
      setShowError(true);
      return;
    }
    onSave(amount);
    router.back();
  };

  const clear = () => {
    onSave(null);
    router.back();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={styles.description}>
        毎月の支出の目安を設定します。家計簿の画面で、残りの金額と使用率を確認できます。
      </Text>

      <View style={styles.group}>
        <Text style={styles.label}>1 か月の予算</Text>
        <View style={[styles.amountBox, showError && styles.inputError]}>
          <Text style={styles.yen}>¥</Text>
          <TextInput
            value={amountText}
            onChangeText={(text) => {
              const next = sanitizeAmountInput(text);
              setAmountText(next);
              if (parseAmount(next) !== null) setShowError(false);
            }}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            inputMode="numeric"
            autoFocus
            accessibilityLabel="1 か月の予算"
            style={styles.amountInput}
          />
        </View>
        {showError ? (
          <Text style={styles.error}>1 円〜1,000 万円の金額を入力してください</Text>
        ) : null}
      </View>

      <Pressable
        onPress={save}
        accessibilityRole="button"
        style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
      >
        <Text style={styles.saveLabel}>予算を保存</Text>
      </Pressable>

      {initial !== null ? (
        <Pressable
          onPress={clear}
          accessibilityRole="button"
          style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
        >
          <Text style={styles.clearLabel}>予算の設定をやめる</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.xl },
  description: { fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  group: { gap: spacing.sm },
  label: { fontSize: 15, fontWeight: '700', color: colors.text },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  inputError: { borderColor: colors.danger },
  yen: { fontSize: fontSize.title, fontWeight: '700', color: colors.textSecondary },
  amountInput: {
    flex: 1,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  error: { fontSize: fontSize.caption, color: colors.danger },
  saveButton: {
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: { fontSize: fontSize.body, fontWeight: '700', color: colors.onPrimary },
  clearButton: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearLabel: { fontSize: fontSize.body, fontWeight: '600', color: colors.danger },
  pressed: { opacity: 0.7 },
});
