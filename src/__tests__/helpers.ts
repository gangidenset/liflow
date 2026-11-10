import type { Task } from '@/types/task';

/** テスト用のタスクを作る。指定しない項目は既定値になる。 */
export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'タスク',
    note: '',
    dueDate: null,
    priority: 'medium',
    completed: false,
    completedAt: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}
