import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describeAiError } from '@/ai/aiClient';
import { requestPlanToday, selectCandidates, selectTodayTasks, type PlanResult } from '@/ai/planToday';
import { Button } from '@/components/Button';
import { PRIORITY_COLORS } from '@/components/PriorityBadge';
import { useTasks } from '@/context/TaskContext';
import { useTodayKey } from '@/hooks/useTodayKey';
import { cardShadow, colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';
import { PRIORITY_LABELS } from '@/types/task';
import { formatDueLabel } from '@/utils/date';

/** 未完了のタスクから、今日やるとよいものを AI に選んでもらう画面 */
export default function AiPlanScreen() {
  const insets = useSafeAreaInsets();
  const todayKey = useTodayKey();
  const { tasks, updateTask } = useTasks();

  const candidates = useMemo(() => selectCandidates(tasks, todayKey), [tasks, todayKey]);
  const todayTasks = useMemo(() => selectTodayTasks(tasks, todayKey), [tasks, todayKey]);

  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [unselected, setUnselected] = useState<Set<string>>(new Set());
  const [appliedCount, setAppliedCount] = useState<number | null>(null);

  const ask = async () => {
    setIsAsking(true);
    setError(null);
    setPlan(null);
    setUnselected(new Set());
    try {
      setPlan(await requestPlanToday(candidates, todayTasks));
    } catch (e) {
      setError(describeAiError(e));
    } finally {
      setIsAsking(false);
    }
  };

  const toggle = (id: string) =>
    setUnselected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selected = plan?.suggestions.filter((s) => !unselected.has(s.task.id)) ?? [];

  /** 選んだタスクの期限を今日にする（提案を見ている間に変わった場合に備え、最新の内容を使う） */
  const apply = () => {
    let count = 0;
    for (const { task } of selected) {
      const latest = tasks.find((t) => t.id === task.id);
      if (!latest || latest.completed) continue;
      updateTask(latest.id, {
        title: latest.title,
        note: latest.note,
        priority: latest.priority,
        dueDate: todayKey,
      });
      count += 1;
    }
    setAppliedCount(count);
  };

  if (appliedCount !== null) {
    return (
      <View style={[styles.screen, styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Stack.Screen options={{ title: '今日やることの提案' }} />
        <View style={styles.done} accessibilityRole="alert">
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          <Text style={styles.doneText}>{appliedCount} 件を今日のタスクに入れました。</Text>
        </View>
        <Button label="閉じる" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
    >
      <Stack.Screen options={{ title: '今日やることの提案' }} />

      {candidates.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.body}>
            提案できるタスクがありません。期限のないタスクや、2 週間以内に期限が来るタスクがあると、その中から今日やるとよいものを
            AI が選びます。
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.description}>
            期限のないタスクと、2 週間以内に期限が来るタスク（{candidates.length} 件）から、今日やるとよいものを AI
            が選びます。選んだタスクは期限が今日になります。
          </Text>
          <Text style={styles.caption}>
            これらのタスクと今日の予定の名前・期限・優先度、候補のメモの先頭が、AI（Claude）に送られます。
          </Text>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button
            label={plan ? 'もう一度提案してもらう' : '提案してもらう'}
            variant={plan ? 'secondary' : 'primary'}
            loading={isAsking}
            onPress={() => void ask()}
          />
        </>
      )}

      {plan ? (
        <View style={styles.results}>
          {plan.message ? (
            <View style={styles.message}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
              <Text style={styles.messageText}>{plan.message}</Text>
            </View>
          ) : null}
          {plan.suggestions.length === 0 ? (
            <Text style={styles.body} accessibilityRole="alert">
              今日は追加で提案するタスクはありません。
            </Text>
          ) : (
            <>
              {plan.suggestions.map(({ task, reason }) => {
                const isSelected = !unselected.has(task.id);
                return (
                  <Pressable
                    key={task.id}
                    onPress={() => toggle(task.id)}
                    accessibilityRole="checkbox"
                    aria-checked={isSelected}
                    accessibilityLabel={`${task.title}を今日やる`}
                    style={[styles.suggestion, !isSelected && styles.suggestionOff]}
                  >
                    <View style={[styles.accent, { backgroundColor: PRIORITY_COLORS[task.priority] }]} />
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={26}
                      color={isSelected ? colors.primary : colors.textMuted}
                    />
                    <View style={styles.suggestionBody}>
                      <Text style={styles.title}>{task.title}</Text>
                      <Text style={styles.meta}>
                        {`優先度 ${PRIORITY_LABELS[task.priority]}・${
                          task.dueDate ? formatDueLabel(task.dueDate, todayKey) : '期限なし'
                        }`}
                      </Text>
                      {reason ? <Text style={styles.reason}>{reason}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
              <Button
                label={`選んだ ${selected.length} 件を今日やる`}
                disabled={selected.length === 0}
                onPress={apply}
              />
            </>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.lg },
  description: { fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  caption: { fontSize: fontSize.caption, lineHeight: 20, color: colors.textMuted },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  error: { fontSize: fontSize.caption, lineHeight: 20, color: colors.danger },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...cardShadow,
  },
  results: { gap: spacing.md },
  message: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  messageText: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.primary },
  suggestion: {
    minHeight: MIN_TOUCH + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...cardShadow,
  },
  suggestionOff: { opacity: 0.55 },
  accent: { width: 5, alignSelf: 'stretch', marginVertical: -spacing.md },
  suggestionBody: { flex: 1, gap: 2 },
  title: { fontSize: fontSize.body, fontWeight: '600', color: colors.text },
  meta: { fontSize: fontSize.caption, color: colors.textSecondary },
  reason: { fontSize: fontSize.caption, lineHeight: 18, color: colors.primary },
  done: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  doneText: { fontSize: fontSize.subtitle, fontWeight: '700', color: colors.text, textAlign: 'center' },
});
