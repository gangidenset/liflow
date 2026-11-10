import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DueDateField } from '@/components/DueDateField';
import { PRIORITY_COLORS } from '@/components/PriorityBadge';
import { useTasks } from '@/context/TaskContext';
import { useTodayKey } from '@/hooks/useTodayKey';
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';
import { PRIORITY_LABELS, PRIORITY_ORDER, type Priority } from '@/types/task';
import { confirmDestructive } from '@/utils/confirm';

const TITLE_MAX_LENGTH = 100;
const NOTE_MAX_LENGTH = 1000;

/** タスクの新規登録・編集画面。id パラメータがあれば編集、なければ新規登録。 */
export default function TaskEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { tasks, isLoaded, addTask, updateTask, deleteTask } = useTasks();
  const editingTask = id ? tasks.find((task) => task.id === id) : undefined;

  if (id && !editingTask) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: 'タスクを編集' }} />
        <Text style={styles.missingText}>
          {isLoaded ? 'このタスクは見つかりませんでした。' : '読み込み中…'}
        </Text>
      </View>
    );
  }

  return (
    <TaskForm
      // 編集対象ごとにフォームの入力状態を作り直す
      key={editingTask?.id ?? 'new'}
      isEdit={editingTask !== undefined}
      initial={{
        title: editingTask?.title ?? '',
        note: editingTask?.note ?? '',
        dueDate: editingTask?.dueDate ?? null,
        priority: editingTask?.priority ?? 'medium',
      }}
      onSubmit={(input) => {
        if (editingTask) updateTask(editingTask.id, input);
        else addTask(input);
        router.back();
      }}
      onDelete={() => {
        if (!editingTask) return;
        confirmDestructive({
          title: 'タスクを削除しますか？',
          message: `「${editingTask.title}」を削除します。この操作は取り消せません。`,
          confirmLabel: '削除',
          onConfirm: () => {
            router.back();
            deleteTask(editingTask.id);
          },
        });
      }}
    />
  );
}

type FormValues = {
  title: string;
  note: string;
  dueDate: string | null;
  priority: Priority;
};

type TaskFormProps = {
  isEdit: boolean;
  initial: FormValues;
  onSubmit: (values: FormValues) => void;
  onDelete: () => void;
};

function TaskForm({ isEdit, initial, onSubmit, onDelete }: TaskFormProps) {
  const insets = useSafeAreaInsets();
  const todayKey = useTodayKey();
  const [title, setTitle] = useState(initial.title);
  const [note, setNote] = useState(initial.note);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [priority, setPriority] = useState(initial.priority);
  const [showTitleError, setShowTitleError] = useState(false);

  const submit = () => {
    if (title.trim() === '') {
      setShowTitleError(true);
      return;
    }
    onSubmit({ title, note, dueDate, priority });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ title: isEdit ? 'タスクを編集' : 'タスクを追加' }} />

      <View style={styles.group}>
        <Text style={styles.label}>
          タスク名<Text style={styles.required}>　必須</Text>
        </Text>
        <TextInput
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            if (text.trim() !== '') setShowTitleError(false);
          }}
          placeholder="例：牛乳を買う"
          placeholderTextColor={colors.textMuted}
          maxLength={TITLE_MAX_LENGTH}
          autoFocus={!isEdit}
          returnKeyType="done"
          accessibilityLabel="タスク名"
          style={[styles.input, showTitleError && styles.inputError]}
        />
        {showTitleError ? <Text style={styles.error}>タスク名を入力してください</Text> : null}
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>詳細・メモ</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="補足があれば入力"
          placeholderTextColor={colors.textMuted}
          maxLength={NOTE_MAX_LENGTH}
          multiline
          textAlignVertical="top"
          accessibilityLabel="詳細・メモ"
          style={[styles.input, styles.noteInput]}
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>期限</Text>
        <DueDateField value={dueDate} todayKey={todayKey} onChange={setDueDate} />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>優先度</Text>
        <View style={styles.priorityRow} accessibilityRole="radiogroup">
          {PRIORITY_ORDER.map((key) => {
            const selected = key === priority;
            const color = PRIORITY_COLORS[key];
            return (
              <Pressable
                key={key}
                onPress={() => setPriority(key)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`優先度 ${PRIORITY_LABELS[key]}`}
                style={[
                  styles.priorityOption,
                  selected && { borderColor: color, backgroundColor: color },
                ]}
              >
                <View
                  style={[styles.priorityDot, { backgroundColor: selected ? colors.onPrimary : color }]}
                />
                <Text style={[styles.priorityLabel, selected && styles.priorityLabelSelected]}>
                  {PRIORITY_LABELS[key]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        onPress={submit}
        accessibilityRole="button"
        style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
      >
        <Text style={styles.saveLabel}>{isEdit ? '変更を保存' : 'タスクを追加'}</Text>
      </Pressable>

      {isEdit ? (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        >
          <Text style={styles.deleteLabel}>このタスクを削除</Text>
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
  group: { gap: spacing.sm },
  label: { fontSize: 15, fontWeight: '700', color: colors.text },
  required: { fontSize: fontSize.caption, fontWeight: '600', color: colors.danger },
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
  noteInput: { minHeight: 110 },
  error: { fontSize: fontSize.caption, color: colors.danger },
  priorityRow: { flexDirection: 'row', gap: spacing.sm },
  priorityOption: {
    flex: 1,
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  priorityLabel: { fontSize: fontSize.body, fontWeight: '700', color: colors.text },
  priorityLabelSelected: { color: colors.onPrimary },
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
