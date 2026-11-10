import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { FilterTabs } from '@/components/FilterTabs';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StorageErrorBanner } from '@/components/StorageErrorBanner';
import { TaskItem } from '@/components/TaskItem';
import { useTasks } from '@/context/TaskContext';
import { useTodayKey } from '@/hooks/useTodayKey';
import { colors, spacing } from '@/theme';
import type { TaskFilter } from '@/types/task';
import { filterTasks, sortTasks } from '@/utils/taskSort';

const EMPTY_MESSAGES: Record<TaskFilter, { title: string; message?: string }> = {
  all: { title: 'タスクはまだありません', message: '右下の＋ボタンからタスクを追加できます' },
  active: { title: '未完了のタスクはありません' },
  completed: { title: '完了済みのタスクはありません' },
};

export default function TasksScreen() {
  const { tasks, isLoaded, toggleTask } = useTasks();
  const todayKey = useTodayKey();
  const [filter, setFilter] = useState<TaskFilter>('all');

  const visibleTasks = useMemo(() => sortTasks(filterTasks(tasks, filter)), [tasks, filter]);
  const counts = useMemo(() => {
    const completed = tasks.filter((task) => task.completed).length;
    return { all: tasks.length, active: tasks.length - completed, completed };
  }, [tasks]);

  const openTask = useCallback((id: string) => {
    router.push({ pathname: '/task-editor', params: { id } });
  }, []);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="タスク一覧" />
      <StorageErrorBanner />
      <View style={styles.filter}>
        <FilterTabs value={filter} counts={counts} onChange={setFilter} />
      </View>
      {isLoaded ? (
        <FlatList
          data={visibleTasks}
          keyExtractor={(task) => task.id}
          contentContainerStyle={styles.content}
          renderItem={({ item }) => (
            <TaskItem task={item} todayKey={todayKey} onToggle={toggleTask} onPress={openTask} />
          )}
          ListEmptyComponent={<EmptyState icon="file-tray-outline" {...EMPTY_MESSAGES[filter]} />}
        />
      ) : (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      )}
      <AddButton />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  filter: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: 110,
  },
  loading: { marginTop: spacing.xxl },
});
