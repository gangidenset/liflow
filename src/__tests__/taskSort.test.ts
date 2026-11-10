import { filterTasks, isTodayTask, sortTasks } from '@/utils/taskSort';

import { makeTask } from './helpers';

const ids = (tasks: { id: string }[]) => tasks.map((task) => task.id);

describe('sortTasks', () => {
  it('未完了を完了済みより前に並べる', () => {
    const tasks = [
      makeTask({ id: 'done', completed: true, completedAt: '2026-11-10T01:00:00.000Z' }),
      makeTask({ id: 'open' }),
    ];
    expect(ids(sortTasks(tasks))).toEqual(['open', 'done']);
  });

  it('未完了は期限の早い順、期限なしは最後', () => {
    const tasks = [
      makeTask({ id: 'none' }),
      makeTask({ id: 'late', dueDate: '2026-11-20' }),
      makeTask({ id: 'early', dueDate: '2026-11-08' }),
    ];
    expect(ids(sortTasks(tasks))).toEqual(['early', 'late', 'none']);
  });

  it('期限が同じなら優先度の高い順', () => {
    const tasks = [
      makeTask({ id: 'low', dueDate: '2026-11-10', priority: 'low' }),
      makeTask({ id: 'high', dueDate: '2026-11-10', priority: 'high' }),
      makeTask({ id: 'medium', dueDate: '2026-11-10', priority: 'medium' }),
    ];
    expect(ids(sortTasks(tasks))).toEqual(['high', 'medium', 'low']);
  });

  it('期限も優先度も同じなら新しく作った順', () => {
    const tasks = [
      makeTask({ id: 'old', createdAt: '2026-11-01T00:00:00.000Z' }),
      makeTask({ id: 'new', createdAt: '2026-11-05T00:00:00.000Z' }),
    ];
    expect(ids(sortTasks(tasks))).toEqual(['new', 'old']);
  });

  it('完了済みは完了した日時の新しい順', () => {
    const tasks = [
      makeTask({ id: 'first', completed: true, completedAt: '2026-11-09T00:00:00.000Z' }),
      makeTask({ id: 'second', completed: true, completedAt: '2026-11-10T00:00:00.000Z' }),
    ];
    expect(ids(sortTasks(tasks))).toEqual(['second', 'first']);
  });

  it('元の配列を書き換えない', () => {
    const tasks = [makeTask({ id: 'b' }), makeTask({ id: 'a', dueDate: '2026-11-10' })];
    sortTasks(tasks);
    expect(ids(tasks)).toEqual(['b', 'a']);
  });
});

describe('filterTasks', () => {
  const tasks = [
    makeTask({ id: 'open' }),
    makeTask({ id: 'done', completed: true, completedAt: '2026-11-10T00:00:00.000Z' }),
  ];

  it('すべて・未完了・完了済みで絞り込む', () => {
    expect(ids(filterTasks(tasks, 'all'))).toEqual(['open', 'done']);
    expect(ids(filterTasks(tasks, 'active'))).toEqual(['open']);
    expect(ids(filterTasks(tasks, 'completed'))).toEqual(['done']);
  });
});

describe('isTodayTask', () => {
  const today = '2026-11-10';
  // 端末ローカルで「今日」「昨日」になる完了日時
  const completedToday = new Date(2026, 10, 10, 9, 0).toISOString();
  const completedYesterday = new Date(2026, 10, 9, 9, 0).toISOString();

  it('期限なしは含めない', () => {
    expect(isTodayTask(makeTask(), today)).toBe(false);
  });

  it('期限が今日なら、完了・未完了どちらも含める', () => {
    expect(isTodayTask(makeTask({ dueDate: today }), today)).toBe(true);
    expect(
      isTodayTask(makeTask({ dueDate: today, completed: true, completedAt: completedToday }), today),
    ).toBe(true);
  });

  it('期限が明日以降なら含めない', () => {
    expect(isTodayTask(makeTask({ dueDate: '2026-11-11' }), today)).toBe(false);
  });

  it('期限切れの未完了は含める', () => {
    expect(isTodayTask(makeTask({ dueDate: '2026-11-08' }), today)).toBe(true);
  });

  it('期限切れを今日完了にしたものは含め、昨日以前に完了したものは含めない', () => {
    const overdue = { dueDate: '2026-11-08', completed: true };
    expect(isTodayTask(makeTask({ ...overdue, completedAt: completedToday }), today)).toBe(true);
    expect(isTodayTask(makeTask({ ...overdue, completedAt: completedYesterday }), today)).toBe(false);
  });
});
