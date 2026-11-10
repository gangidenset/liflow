import type { Priority, Task, TaskFilter } from '@/types/task';
import { toDateKey } from '@/utils/date';

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/**
 * 未完了を先に、期限の早い順 → 優先度の高い順 → 新しい順に並べる。
 * 期限なしは期限ありの後ろ。完了済みは完了した日時の新しい順。
 */
export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.completed && b.completed) {
      return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
    }
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function filterTasks(tasks: readonly Task[], filter: TaskFilter): Task[] {
  if (filter === 'active') return tasks.filter((t) => !t.completed);
  if (filter === 'completed') return tasks.filter((t) => t.completed);
  return [...tasks];
}

/**
 * ホーム画面の「今日のタスク」に含めるか。
 * - 期限が今日のタスク
 * - 期限を過ぎた未完了のタスク
 * - 期限を過ぎていたが今日完了にしたタスク（今日の進捗として数える）
 */
export function isTodayTask(task: Task, todayKey: string): boolean {
  if (task.dueDate === null) return false;
  if (task.dueDate === todayKey) return true;
  if (task.dueDate > todayKey) return false;
  if (!task.completed) return true;
  return task.completedAt !== null && toDateKey(new Date(task.completedAt)) === todayKey;
}
