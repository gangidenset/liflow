import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { ProgressCard } from '@/components/ProgressCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StorageErrorBanner } from '@/components/StorageErrorBanner';
import { TaskItem } from '@/components/TaskItem';
import { useTasks } from '@/context/TaskContext';
import { useTodayKey } from '@/hooks/useTodayKey';
import { colors, fontSize, spacing } from '@/theme';
import { formatFullDate, fromDateKey } from '@/utils/date';
import { isTodayTask, sortTasks } from '@/utils/taskSort';

export default function HomeScreen() {
  const { tasks, isLoaded, toggleTask } = useTasks();
  const todayKey = useTodayKey();

  const todayTasks = useMemo(
    () => sortTasks(tasks.filter((task) => isTodayTask(task, todayKey))),
    [tasks, todayKey],
  );
  const completedCount = todayTasks.filter((task) => task.completed).length;

  const openTask = useCallback((id: string) => {
    router.push({ pathname: '/task-editor', params: { id } });
  }, []);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="今日" subtitle={formatFullDate(fromDateKey(todayKey))} />
      <StorageErrorBanner />
      {isLoaded ? (
        <FlatList
          data={todayTasks}
          keyExtractor={(task) => task.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <>
              <ProgressCard
                completedCount={completedCount}
                activeCount={todayTasks.length - completedCount}
              />
              <Text style={styles.sectionTitle}>今日のタスク</Text>
            </>
          }
          renderItem={({ item }) => (
            <TaskItem task={item} todayKey={todayKey} onToggle={toggleTask} onPress={openTask} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="sunny-outline"
              title="今日のタスクはありません"
              message="期限が今日のタスクと、期限を過ぎたタスクがここに表示されます"
            />
          }
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
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 110,
  },
  sectionTitle: {
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  loading: { marginTop: spacing.xxl },
});
