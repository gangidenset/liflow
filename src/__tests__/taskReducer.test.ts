import { taskReducer } from '@/context/TaskContext';

import { makeTask } from './helpers';

const NOW = '2026-11-10T03:00:00.000Z';

describe('taskReducer', () => {
  it('loaded: 読み込んだ一覧に置き換える', () => {
    const loaded = [makeTask({ id: 'a' })];
    expect(taskReducer([makeTask({ id: 'old' })], { type: 'loaded', tasks: loaded })).toEqual(loaded);
  });

  it('added: 先頭に追加する', () => {
    const state = [makeTask({ id: 'a' })];
    const next = taskReducer(state, { type: 'added', task: makeTask({ id: 'b' }) });
    expect(next.map((task) => task.id)).toEqual(['b', 'a']);
  });

  it('updated: 対象だけ入力内容と更新日時を書き換える', () => {
    const state = [makeTask({ id: 'a', title: '旧' }), makeTask({ id: 'b', title: '他' })];
    const next = taskReducer(state, {
      type: 'updated',
      id: 'a',
      input: { title: '新', note: 'メモ', dueDate: '2026-11-12', priority: 'high' },
      now: NOW,
    });
    expect(next[0]).toMatchObject({
      id: 'a',
      title: '新',
      note: 'メモ',
      dueDate: '2026-11-12',
      priority: 'high',
      updatedAt: NOW,
      createdAt: state[0].createdAt,
      completed: false,
    });
    expect(next[1]).toBe(state[1]);
  });

  it('toggled: 完了にすると完了日時が入り、戻すと消える', () => {
    const state = [makeTask({ id: 'a' })];
    const done = taskReducer(state, { type: 'toggled', id: 'a', now: NOW });
    expect(done[0]).toMatchObject({ completed: true, completedAt: NOW, updatedAt: NOW });

    const reopened = taskReducer(done, { type: 'toggled', id: 'a', now: NOW });
    expect(reopened[0]).toMatchObject({ completed: false, completedAt: null });
  });

  it('deleted: 対象だけ取り除く', () => {
    const state = [makeTask({ id: 'a' }), makeTask({ id: 'b' })];
    expect(taskReducer(state, { type: 'deleted', id: 'a' }).map((task) => task.id)).toEqual(['b']);
  });

  it('存在しない id の操作では内容が変わらない', () => {
    const state = [makeTask({ id: 'a' })];
    expect(taskReducer(state, { type: 'toggled', id: 'x', now: NOW })).toEqual(state);
    expect(taskReducer(state, { type: 'deleted', id: 'x' })).toEqual(state);
  });

  it('元の state を書き換えない', () => {
    const state = [makeTask({ id: 'a' })];
    taskReducer(state, { type: 'toggled', id: 'a', now: NOW });
    expect(state[0].completed).toBe(false);
  });
});
