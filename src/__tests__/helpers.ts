import type { LedgerEntry } from '@/types/ledger';
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

/** テスト用の家計簿の記録を作る。指定しない項目は既定値になる。 */
export function makeEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: 'entry-1',
    type: 'expense',
    date: '2026-11-10',
    amount: 1000,
    category: 'food',
    note: '',
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
    ...overrides,
  };
}
