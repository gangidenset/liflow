import { mapPlan, selectCandidates, selectTodayTasks } from '@/ai/planToday';

import { makeTask } from './helpers';

const TODAY = '2026-11-16';

describe('selectCandidates', () => {
  it('期限なし・2 週間以内の未完了タスクだけを、期限と優先度の順に選ぶ', () => {
    const tasks = [
      makeTask({ id: 'none-low', priority: 'low' }),
      makeTask({ id: 'soon', dueDate: '2026-11-18' }),
      makeTask({ id: 'none-high', priority: 'high' }),
      makeTask({ id: 'far', dueDate: '2026-12-31' }),
      makeTask({ id: 'edge', dueDate: '2026-11-30' }),
      makeTask({ id: 'today', dueDate: TODAY }),
      makeTask({ id: 'overdue', dueDate: '2026-11-10' }),
      makeTask({ id: 'done', completed: true, completedAt: '2026-11-15T00:00:00.000Z' }),
      makeTask({ id: 'deleted', deletedAt: '2026-11-15T00:00:00.000Z' }),
    ];
    expect(selectCandidates(tasks, TODAY).map((t) => t.id)).toEqual([
      'soon',
      'edge',
      'none-high',
      'none-low',
    ]);
  });

  it('最大 30 件まで', () => {
    const tasks = Array.from({ length: 40 }, (_, i) => makeTask({ id: `t${i}` }));
    expect(selectCandidates(tasks, TODAY)).toHaveLength(30);
  });
});

describe('selectTodayTasks', () => {
  it('今日の一覧に入る未完了タスク（期限が今日・期限切れ）', () => {
    const tasks = [
      makeTask({ id: 'today', dueDate: TODAY }),
      makeTask({ id: 'overdue', dueDate: '2026-11-10' }),
      makeTask({ id: 'done', dueDate: TODAY, completed: true, completedAt: '2026-11-16T01:00:00.000Z' }),
      makeTask({ id: 'none' }),
    ];
    expect(selectTodayTasks(tasks, TODAY).map((t) => t.id)).toEqual(['overdue', 'today']);
  });
});

describe('mapPlan', () => {
  const candidates = [makeTask({ id: 'a' }), makeTask({ id: 'b' }), makeTask({ id: 'c' })];

  it('番号（1 始まり）を候補のタスクに対応づける', () => {
    expect(
      mapPlan(
        { message: 'がんばろう', suggestions: [{ n: 3, reason: '期限が近い' }, { n: 1, reason: '' }] },
        candidates,
      ),
    ).toEqual({
      message: 'がんばろう',
      suggestions: [
        { task: candidates[2], reason: '期限が近い' },
        { task: candidates[0], reason: '' },
      ],
    });
  });

  it('範囲外・重複・数値でない番号は捨てる', () => {
    const result = mapPlan(
      { suggestions: [{ n: 0 }, { n: 4 }, { n: 2 }, { n: 2 }, { n: '1' }, { n: 1.5 }, null] },
      candidates,
    );
    expect(result.suggestions.map((s) => s.task.id)).toEqual(['b']);
    expect(result.message).toBe('');
  });
});
