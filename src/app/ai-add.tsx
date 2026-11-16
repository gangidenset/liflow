import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describeAiError } from '@/ai/aiClient';
import { QUICK_ADD_MAX_TEXT, requestQuickAdd, type Draft } from '@/ai/quickAdd';
import { Button } from '@/components/Button';
import { PRIORITY_COLORS } from '@/components/PriorityBadge';
import { useLedger } from '@/context/LedgerContext';
import { useTasks } from '@/context/TaskContext';
import { useTodayKey } from '@/hooks/useTodayKey';
import { cardShadow, colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';
import { ENTRY_TYPE_LABELS, getCategoryInfo } from '@/types/ledger';
import { PRIORITY_LABELS } from '@/types/task';
import { formatDateKey } from '@/utils/date';
import { formatYen } from '@/utils/ledger';

type Item = { key: string; draft: Draft; selected: boolean };

/** 文章を AI に読み取らせて、タスク・家計簿の下書きを作り、選んだものを追加する画面 */
export default function AiAddScreen() {
  const insets = useSafeAreaInsets();
  const todayKey = useTodayKey();
  const { addTask } = useTasks();
  const { addEntry } = useLedger();

  const [text, setText] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [result, setResult] = useState<{ tasks: number; entries: number } | null>(null);

  const read = async () => {
    if (text.trim() === '') {
      setError('読み取らせたい文章を入力してください。');
      return;
    }
    setIsReading(true);
    setError(null);
    setItems(null);
    try {
      const drafts = await requestQuickAdd(text.trim());
      setItems(drafts.map((draft, index) => ({ key: `${Date.now()}-${index}`, draft, selected: true })));
    } catch (e) {
      setError(describeAiError(e));
    } finally {
      setIsReading(false);
    }
  };

  const toggle = (key: string) =>
    setItems((current) =>
      current ? current.map((item) => (item.key === key ? { ...item, selected: !item.selected } : item)) : current,
    );

  /** 編集画面で内容を直してから追加する（この一覧からは外す） */
  const editAndAdd = (item: Item) => {
    setItems((current) => (current ? current.filter((i) => i.key !== item.key) : current));
    const { draft } = item;
    if (draft.kind === 'task') {
      router.push({
        pathname: '/task-editor',
        params: {
          title: draft.title,
          note: draft.note,
          priority: draft.priority,
          ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
        },
      });
    } else {
      router.push({
        pathname: '/ledger-editor',
        params: {
          type: draft.kind,
          amount: String(draft.amount),
          date: draft.date,
          category: draft.category,
          note: draft.note,
        },
      });
    }
  };

  const selected = items?.filter((item) => item.selected) ?? [];

  const addSelected = () => {
    let tasks = 0;
    let entries = 0;
    for (const { draft } of selected) {
      if (draft.kind === 'task') {
        addTask({ title: draft.title, note: draft.note, dueDate: draft.dueDate, priority: draft.priority });
        tasks += 1;
      } else {
        addEntry({
          type: draft.kind,
          amount: draft.amount,
          date: draft.date,
          category: draft.category,
          note: draft.note,
        });
        entries += 1;
      }
    }
    setResult({ tasks, entries });
    setItems(null);
    setText('');
  };

  if (result) {
    const parts = [
      result.tasks > 0 ? `タスク ${result.tasks} 件` : null,
      result.entries > 0 ? `家計簿 ${result.entries} 件` : null,
    ].filter(Boolean);
    return (
      <View style={[styles.screen, styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Stack.Screen options={{ title: 'AI で追加' }} />
        <View style={styles.done} accessibilityRole="alert">
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          <Text style={styles.doneText}>{parts.join('、')}を追加しました。</Text>
        </View>
        <Button label="閉じる" onPress={() => router.back()} />
        <Button label="続けて入力する" variant="secondary" onPress={() => setResult(null)} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ title: 'AI で追加' }} />

      <Text style={styles.description}>
        やることや、使った・受け取ったお金を、思いつくまま書いてください。AI がタスクと家計簿の下書きを作ります。
      </Text>

      <View style={styles.group}>
        <TextInput
          value={text}
          onChangeText={(value) => {
            setText(value);
            if (error) setError(null);
          }}
          placeholder={'例：金曜までに歯医者を予約\nランチ 980円\n明日は牛乳と卵を買う'}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={QUICK_ADD_MAX_TEXT}
          textAlignVertical="top"
          autoFocus
          accessibilityLabel="AI に読み取らせる文章"
          style={styles.input}
        />
        <Text style={styles.counter}>
          {text.length} / {QUICK_ADD_MAX_TEXT}
        </Text>
      </View>

      <Text style={styles.caption}>入力した文章と今日の日付が、AI（Claude）に送られます。</Text>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Button label="AI で読み取る" loading={isReading} onPress={() => void read()} />

      {items ? (
        items.length === 0 ? (
          <Text style={styles.empty} accessibilityRole="alert">
            読み取れる項目がありませんでした。やることや金額がわかるように書いて、もう一度お試しください。
          </Text>
        ) : (
          <View style={styles.results}>
            <Text style={styles.sectionTitle}>追加する項目を選んでください</Text>
            {items.map((item) => (
              <DraftCard
                key={item.key}
                item={item}
                todayKey={todayKey}
                onToggle={() => toggle(item.key)}
                onEdit={() => editAndAdd(item)}
              />
            ))}
            <Button
              label={`選んだ ${selected.length} 件を追加`}
              disabled={selected.length === 0}
              onPress={addSelected}
            />
          </View>
        )
      ) : null}
    </ScrollView>
  );
}

function DraftCard({
  item,
  todayKey,
  onToggle,
  onEdit,
}: {
  item: Item;
  todayKey: string;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const { draft, selected } = item;
  let title: string;
  let details: string[];
  let accent: string;
  let icon: 'checkbox-outline' | 'remove-circle-outline' | 'add-circle-outline';

  if (draft.kind === 'task') {
    title = draft.title;
    details = [
      'タスク',
      `優先度 ${PRIORITY_LABELS[draft.priority]}`,
      draft.dueDate ? `期限 ${formatDateKey(draft.dueDate, todayKey)}` : '期限なし',
    ];
    accent = PRIORITY_COLORS[draft.priority];
    icon = 'checkbox-outline';
  } else {
    const category = getCategoryInfo(draft.category);
    title = `${ENTRY_TYPE_LABELS[draft.kind]} ${formatYen(draft.amount)}`;
    details = [category.label, formatDateKey(draft.date, todayKey)];
    accent = draft.kind === 'expense' ? colors.danger : colors.success;
    icon = draft.kind === 'expense' ? 'remove-circle-outline' : 'add-circle-outline';
  }
  if (draft.note) details.push(draft.note);

  return (
    <View style={[styles.card, !selected && styles.cardOff]}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        aria-checked={selected}
        accessibilityLabel={`${title}を追加する`}
        style={styles.cardMain}
      >
        <Ionicons
          name={selected ? 'checkbox' : 'square-outline'}
          size={26}
          color={selected ? colors.primary : colors.textMuted}
        />
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Ionicons name={icon} size={16} color={accent} />
            <Text style={styles.cardTitle}>{title}</Text>
          </View>
          <Text style={styles.cardDetails}>{details.join('・')}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${title}を編集して追加`}
        style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
      >
        <Text style={styles.editLabel}>編集</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.lg },
  description: { fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  group: { gap: spacing.xs },
  input: {
    minHeight: 140,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.body,
    lineHeight: 24,
    color: colors.text,
  },
  counter: { fontSize: fontSize.caption, color: colors.textMuted, textAlign: 'right' },
  caption: { fontSize: fontSize.caption, lineHeight: 20, color: colors.textMuted },
  error: { fontSize: fontSize.caption, lineHeight: 20, color: colors.danger },
  empty: { fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  results: { gap: spacing.md },
  sectionTitle: { fontSize: fontSize.subtitle, fontWeight: '700', color: colors.text },
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...cardShadow,
  },
  cardOff: { opacity: 0.55 },
  accent: { width: 5 },
  cardMain: {
    flex: 1,
    minHeight: MIN_TOUCH + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
  },
  cardBody: { flex: 1, gap: 2 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardTitle: { flexShrink: 1, fontSize: fontSize.body, fontWeight: '600', color: colors.text },
  cardDetails: { fontSize: fontSize.caption, lineHeight: 18, color: colors.textSecondary },
  editButton: {
    minWidth: MIN_TOUCH + 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  editLabel: { fontSize: 15, fontWeight: '600', color: colors.primary },
  pressed: { opacity: 0.6 },
  done: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  doneText: { fontSize: fontSize.subtitle, fontWeight: '700', color: colors.text, textAlign: 'center' },
});
