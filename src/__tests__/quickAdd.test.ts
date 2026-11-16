import { parseDrafts } from '@/ai/quickAdd';

describe('parseDrafts', () => {
  it('タスクと支出・収入の下書きを受け取る', () => {
    expect(
      parseDrafts({
        items: [
          { kind: 'task', title: '歯医者を予約する', note: '', dueDate: '2026-11-20', priority: 'high' },
          { kind: 'expense', amount: 980, date: '2026-11-16', category: 'food', note: 'ランチ' },
          { kind: 'income', amount: 250000, date: '2026-11-25', category: 'salary', note: '' },
        ],
      }),
    ).toEqual([
      { kind: 'task', title: '歯医者を予約する', note: '', dueDate: '2026-11-20', priority: 'high' },
      { kind: 'expense', amount: 980, date: '2026-11-16', category: 'food', note: 'ランチ' },
      { kind: 'income', amount: 250000, date: '2026-11-25', category: 'salary', note: '' },
    ]);
  });

  it('形の合わない項目は捨てる', () => {
    expect(
      parseDrafts({
        items: [
          { kind: 'task', title: '' },
          { kind: 'expense', amount: 0, date: '2026-11-16', category: 'food' },
          { kind: 'expense', amount: 1.5, date: '2026-11-16', category: 'food' },
          { kind: 'expense', amount: 100, date: '11/16', category: 'food' },
          { kind: 'expense', amount: 100, date: '2026-11-16', category: 'salary' },
          { kind: 'income', amount: 100, date: '2026-11-16', category: 'food' },
          { kind: 'transfer', amount: 100 },
          null,
        ],
      }),
    ).toEqual([]);
  });

  it('タスクの期限や優先度が不正なら、期限なし・優先度 中にする', () => {
    expect(parseDrafts({ items: [{ kind: 'task', title: 't', dueDate: 'x', priority: 'urgent' }] })).toEqual([
      { kind: 'task', title: 't', note: '', dueDate: null, priority: 'medium' },
    ]);
  });

  it('items が無ければ空', () => {
    expect(parseDrafts(null)).toEqual([]);
    expect(parseDrafts({ items: 'x' })).toEqual([]);
  });
});
