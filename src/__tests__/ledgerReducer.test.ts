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

  it('deleted: 対象だけ取り除く', () => {
    const state = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
    expect(ledgerReducer(state, { type: 'deleted', id: 'a' }).map((e) => e.id)).toEqual(['b']);
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
