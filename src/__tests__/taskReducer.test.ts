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

  it('deleted: 記録は残し、削除日時と更新日時を付ける（同期で削除を伝えるため）', () => {
    const state = [makeTask({ id: 'a' }), makeTask({ id: 'b' })];
    const next = taskReducer(state, { type: 'deleted', id: 'a', now: NOW });
    expect(next[0]).toMatchObject({ id: 'a', deletedAt: NOW, updatedAt: NOW });
    expect(next[1]).toBe(state[1]);
  });

  it('merged: 新しい方を残し、手元にない記録を加える', () => {
    const state = [
      makeTask({ id: 'a', title: '手元が新しい', updatedAt: '2026-11-10T00:00:00.000Z' }),
      makeTask({ id: 'b', title: '手元が古い', updatedAt: '2026-11-01T00:00:00.000Z' }),
    ];
    const next = taskReducer(state, {
      type: 'merged',
      tasks: [
        makeTask({ id: 'a', title: '受信が古い', updatedAt: '2026-11-05T00:00:00.000Z' }),
        makeTask({ id: 'b', title: '受信が新しい', updatedAt: '2026-11-05T00:00:00.000Z' }),
        makeTask({ id: 'c', title: '新規' }),
      ],
    });
    expect(next.map((t) => [t.id, t.title])).toEqual([
      ['c', '新規'],
      ['a', '手元が新しい'],
      ['b', '受信が新しい'],
    ]);
  });

  it('merged: 他の端末での削除も取り込む', () => {
    const state = [makeTask({ id: 'a' })];
    const next = taskReducer(state, {
      type: 'merged',
      tasks: [makeTask({ id: 'a', deletedAt: NOW, updatedAt: NOW })],
    });
    expect(next[0].deletedAt).toBe(NOW);
  });

  it('reset: すべて消す', () => {
    expect(taskReducer([makeTask()], { type: 'reset' })).toEqual([]);
  });

  it('存在しない id の操作では内容が変わらない', () => {
    const state = [makeTask({ id: 'a' })];
    expect(taskReducer(state, { type: 'toggled', id: 'x', now: NOW })).toEqual(state);
    expect(taskReducer(state, { type: 'deleted', id: 'x', now: NOW })).toEqual(state);
  });

  it('元の state を書き換えない', () => {
    const state = [makeTask({ id: 'a' })];
    taskReducer(state, { type: 'toggled', id: 'a', now: NOW });
    expect(state[0].completed).toBe(false);
  });
});
