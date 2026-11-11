import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DueDateField } from '@/components/DueDateField';
import { useLedger } from '@/context/LedgerContext';
import { useTodayKey } from '@/hooks/useTodayKey';
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';
import {
  categoriesFor,
  defaultCategoryFor,
  ENTRY_TYPE_LABELS,
  isCategoryOf,
  type EntryType,
  type LedgerCategory,
  type LedgerEntryInput,
} from '@/types/ledger';
import { confirmDestructive } from '@/utils/confirm';
import { formatYen, parseAmount, sanitizeAmountInput } from '@/utils/ledger';

const NOTE_MAX_LENGTH = 200;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 支出・収入の登録・編集画面。id があれば編集、なければ新規登録（date で日付の初期値を指定可）。 */
export default function LedgerEditorScreen() {
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();
  const { entries, isLoaded, addEntry, updateEntry, deleteEntry } = useLedger();
  const todayKey = useTodayKey();
  const editing = id ? entries.find((entry) => entry.id === id) : undefined;

  if (id && !editing) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: '記録を編集' }} />
        <Text style={styles.missingText}>
          {isLoaded ? 'この記録は見つかりませんでした。' : '読み込み中…'}
        </Text>
      </View>
    );
  }

  return (
    <EntryForm
      key={editing?.id ?? 'new'}
      isEdit={editing !== undefined}
      todayKey={todayKey}
      initial={{
        type: editing?.type ?? 'expense',
        date: editing?.date ?? (date && DATE_KEY_PATTERN.test(date) ? date : todayKey),
        amountText: editing ? String(editing.amount) : '',
        category: editing?.category ?? defaultCategoryFor('expense'),
        note: editing?.note ?? '',
      }}
      onSubmit={(input) => {
        if (editing) updateEntry(editing.id, input);
        else addEntry(input);
        router.back();
      }}
      onDelete={() => {
        if (!editing) return;
        confirmDestructive({
          title: 'この記録を削除しますか？',
          message: `${ENTRY_TYPE_LABELS[editing.type]} ${formatYen(editing.amount)} を削除します。この操作は取り消せません。`,
          confirmLabel: '削除',
          onConfirm: () => {
            router.back();
            deleteEntry(editing.id);
          },
        });
      }}
    />
  );
}

type FormValues = {
  type: EntryType;
  date: string;
  amountText: string;
  category: LedgerCategory;
  note: string;
};

type EntryFormProps = {
  isEdit: boolean;
  todayKey: string;
  initial: FormValues;
  onSubmit: (input: LedgerEntryInput) => void;
  onDelete: () => void;
};

function EntryForm({ isEdit, todayKey, initial, onSubmit, onDelete }: EntryFormProps) {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState(initial.type);
  const [date, setDate] = useState(initial.date);
  const [amountText, setAmountText] = useState(initial.amountText);
  const [category, setCategory] = useState(initial.category);
  const [note, setNote] = useState(initial.note);
  const [showAmountError, setShowAmountError] = useState(false);

  const changeType = (next: EntryType) => {
    setType(next);
    // 種類を切り替えたら、その種類で選べるカテゴリに合わせる
    if (!isCategoryOf(next, category)) setCategory(defaultCategoryFor(next));
  };

  const submit = () => {
    const amount = parseAmount(amountText);
    if (amount === null) {
      setShowAmountError(true);
      return;
    }
    onSubmit({ type, date, amount, category, note });
  };

  const typeLabel = ENTRY_TYPE_LABELS[type];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ title: isEdit ? '記録を編集' : '記録を追加' }} />

      <View style={styles.typeRow} accessibilityRole="radiogroup">
        {(['expense', 'income'] as const).map((key) => {
          const selected = key === type;
          return (
            <Pressable
              key={key}
              onPress={() => changeType(key)}
              accessibilityRole="radio"
              aria-checked={selected}
              accessibilityLabel={ENTRY_TYPE_LABELS[key]}
              style={[
                styles.typeOption,
                selected && (key === 'expense' ? styles.typeExpense : styles.typeIncome),
              ]}
            >
              <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>
                {ENTRY_TYPE_LABELS[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>
          金額<Text style={styles.required}>　必須</Text>
        </Text>
        <View style={[styles.amountBox, showAmountError && styles.inputError]}>
          <Text style={styles.yen}>¥</Text>
          <TextInput
            value={amountText}
            onChangeText={(text) => {
              const next = sanitizeAmountInput(text);
              setAmountText(next);
              if (parseAmount(next) !== null) setShowAmountError(false);
            }}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            inputMode="numeric"
            autoFocus={!isEdit}
            accessibilityLabel="金額"
            style={styles.amountInput}
          />
        </View>
        {showAmountError ? (
          <Text style={styles.error}>1 円〜1,000 万円の金額を入力してください</Text>
        ) : null}
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>日付</Text>
        <DueDateField
          value={date}
          todayKey={todayKey}
          onChange={(next) => next && setDate(next)}
          clearable={false}
          label="日付"
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>カテゴリ</Text>
        <View style={styles.categoryGrid} accessibilityRole="radiogroup">
          {categoriesFor(type).map((info) => {
            const selected = info.key === category;
            return (
              <Pressable
                key={info.key}
                onPress={() => setCategory(info.key)}
                accessibilityRole="radio"
                aria-checked={selected}
                accessibilityLabel={`カテゴリ ${info.label}`}
                style={[
                  styles.categoryOption,
                  selected && { borderColor: info.color, backgroundColor: info.color },
                ]}
              >
                <View
                  style={[
                    styles.categoryDot,
                    { backgroundColor: selected ? colors.onPrimary : info.color },
                  ]}
                />
                <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>
                  {info.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>メモ</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="例：スーパーで買い物"
          placeholderTextColor={colors.textMuted}
          maxLength={NOTE_MAX_LENGTH}
          accessibilityLabel="メモ"
          style={styles.input}
        />
      </View>

      <Pressable
        onPress={submit}
        accessibilityRole="button"
        style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
      >
        <Text style={styles.saveLabel}>{isEdit ? '変更を保存' : `${typeLabel}を記録`}</Text>
      </Pressable>

      {isEdit ? (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        >
          <Text style={styles.deleteLabel}>この記録を削除</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.xl },
  missing: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  missingText: { fontSize: fontSize.body, color: colors.textSecondary },
  typeRow: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  typeOption: {
    flex: 1,
    minHeight: MIN_TOUCH - 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md - 2,
  },
  typeExpense: { backgroundColor: colors.danger },
  typeIncome: { backgroundColor: colors.success },
  typeLabel: { fontSize: fontSize.body, fontWeight: '700', color: colors.textSecondary },
  typeLabelSelected: { color: colors.onPrimary },
  group: { gap: spacing.sm },
  label: { fontSize: 15, fontWeight: '700', color: colors.text },
  required: { fontSize: fontSize.caption, fontWeight: '600', color: colors.danger },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  yen: { fontSize: fontSize.title, fontWeight: '700', color: colors.textSecondary },
  amountInput: {
    flex: 1,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  input: {
    minHeight: MIN_TOUCH,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  error: { fontSize: fontSize.caption, color: colors.danger },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryOption: {
    minHeight: MIN_TOUCH - 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
  },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categoryLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  categoryLabelSelected: { color: colors.onPrimary },
  saveButton: {
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  saveLabel: { fontSize: fontSize.body, fontWeight: '700', color: colors.onPrimary },
  deleteButton: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLabel: { fontSize: fontSize.body, fontWeight: '600', color: colors.danger },
  pressed: { opacity: 0.7 },
});
