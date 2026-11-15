import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Priority, Task } from '@/types/task';

const STORAGE_KEY = '@ai-life-manager/tasks/v1';

const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low'];
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 保存データ・同期データを 1 件ずつ検証する。復元できない項目は null。 */
export function parseTask(value: unknown): Task | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.title !== 'string') return null;

  const now = new Date().toISOString();
  const completed = v.completed === true;
  const createdAt = typeof v.createdAt === 'string' ? v.createdAt : now;
  const updatedAt = typeof v.updatedAt === 'string' ? v.updatedAt : createdAt;
  return {
    id: v.id,
    title: v.title,
    note: typeof v.note === 'string' ? v.note : '',
    dueDate: typeof v.dueDate === 'string' && DATE_KEY_PATTERN.test(v.dueDate) ? v.dueDate : null,
    priority: PRIORITIES.includes(v.priority as Priority) ? (v.priority as Priority) : 'medium',
    completed,
    completedAt: completed ? (typeof v.completedAt === 'string' ? v.completedAt : updatedAt) : null,
    createdAt,
    updatedAt,
    // 同期対応前のデータには無いため、未削除として扱う
    deletedAt: typeof v.deletedAt === 'string' ? v.deletedAt : null,
  };
}

export async function loadTasks(): Promise<Task[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('保存データの形式が正しくありません');
  }
  return parsed.map(parseTask).filter((task): task is Task => task !== null);
}

export async function saveTasks(tasks: readonly Task[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export async function clearTasks(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
