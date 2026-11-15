import { ledgerReducer } from '@/context/LedgerContext';

import { makeEntry } from './helpers';

const NOW = '2026-11-10T03:00:00.000Z';

describe('ledgerReducer', () => {
  it('loaded: 読み込んだ一覧に置き換える', () => {
    const loaded = [makeEntry({ id: 'a' })];
    expect(ledgerReducer([makeEntry({ id: 'old' })], { type: 'loaded', entries: loaded })).toEqual(
      loaded,
    );
  });

  it('added: 先頭に追加する', () => {
    const next = ledgerReducer([makeEntry({ id: 'a' })], {
      type: 'added',
      entry: makeEntry({ id: 'b' }),
    });
    expect(next.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('updated: 対象だけ入力内容と更新日時を書き換える', () => {
    const state = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
    const next = ledgerReducer(state, {
      type: 'updated',
      id: 'a',
      input: { type: 'income', date: '2026-11-25', amount: 300000, category: 'salary', note: '11月分' },
      now: NOW,
    });
    expect(next[0]).toMatchObject({
      id: 'a',
      type: 'income',
      date: '2026-11-25',
      amount: 300000,
      category: 'salary',
      note: '11月分',
      updatedAt: NOW,
      createdAt: state[0].createdAt,
    });
    expect(next[1]).toBe(state[1]);
  });

  it('deleted: 記録は残し、削除日時と更新日時を付ける（同期で削除を伝えるため）', () => {
    const state = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
    const next = ledgerReducer(state, { type: 'deleted', id: 'a', now: NOW });
    expect(next[0]).toMatchObject({ id: 'a', deletedAt: NOW, updatedAt: NOW });
    expect(next[1]).toBe(state[1]);
  });

  it('merged: 新しい方を残し、手元にない記録を加える', () => {
    const state = [makeEntry({ id: 'a', amount: 100, updatedAt: '2026-11-01T00:00:00.000Z' })];
    const next = ledgerReducer(state, {
      type: 'merged',
      entries: [
        makeEntry({ id: 'a', amount: 200, updatedAt: '2026-11-05T00:00:00.000Z' }),
        makeEntry({ id: 'b', amount: 300 }),
      ],
    });
    expect(next.map((e) => [e.id, e.amount])).toEqual([
      ['b', 300],
      ['a', 200],
    ]);
  });

  it('reset: すべて消す', () => {
    expect(ledgerReducer([makeEntry()], { type: 'reset' })).toEqual([]);
  });

  it('元の state を書き換えない', () => {
    const state = [makeEntry({ id: 'a', amount: 100 })];
    ledgerReducer(state, {
      type: 'updated',
      id: 'a',
      input: { type: 'expense', date: '2026-11-10', amount: 999, category: 'food', note: '' },
      now: NOW,
    });
    expect(state[0].amount).toBe(100);
  });
});
