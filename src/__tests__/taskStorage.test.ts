import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadTasks, saveTasks } from '@/storage/taskStorage';

import { makeTask } from './helpers';

const STORAGE_KEY = '@ai-life-manager/tasks/v1';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('taskStorage', () => {
  it('保存データがなければ空の一覧を返す', async () => {
    await expect(loadTasks()).resolves.toEqual([]);
  });

  it('保存した一覧をそのまま読み込める', async () => {
    const tasks = [
      makeTask({ id: 'a', title: '牛乳を買う', note: '低脂肪', dueDate: '2026-11-10', priority: 'high' }),
      makeTask({ id: 'b', completed: true, completedAt: '2026-11-10T01:00:00.000Z' }),
    ];
    await saveTasks(tasks);
    await expect(loadTasks()).resolves.toEqual(tasks);
  });

  it('JSON として壊れたデータは例外にする（上書き防止のため）', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{broken');
    await expect(loadTasks()).rejects.toThrow();
  });

  it('配列でないデータは例外にする', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: [] }));
    await expect(loadTasks()).rejects.toThrow('保存データの形式が正しくありません');
  });

  it('id やタスク名のない項目は読み飛ばす', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([null, 'text', { title: 'id なし' }, { id: 'x' }, makeTask({ id: 'ok' })]),
    );
    const loaded = await loadTasks();
    expect(loaded.map((task) => task.id)).toEqual(['ok']);
  });

  it('欠けた項目や不正な値は既定値で補う', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'a', title: '最小', dueDate: '11/10', priority: 'urgent' }]),
    );
    const [task] = await loadTasks();
    expect(task).toMatchObject({
      id: 'a',
      title: '最小',
      note: '',
      dueDate: null,
      priority: 'medium',
      completed: false,
      completedAt: null,
    });
    expect(typeof task.createdAt).toBe('string');
    expect(task.updatedAt).toBe(task.createdAt);
  });

  it('完了済みなのに完了日時がない場合は更新日時で補う', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'a', title: '旧形式', completed: true, updatedAt: '2026-11-09T00:00:00.000Z' },
      ]),
    );
    const [task] = await loadTasks();
    expect(task.completedAt).toBe('2026-11-09T00:00:00.000Z');
  });

  it('未完了のタスクに残った完了日時は消す', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'a', title: 't', completed: false, completedAt: '2026-11-09T00:00:00.000Z' }]),
    );
    const [task] = await loadTasks();
    expect(task.completedAt).toBeNull();
  });
});
