import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadBudget, loadEntries, saveBudget, saveEntries } from '@/storage/ledgerStorage';

import { makeEntry } from './helpers';

const ENTRIES_KEY = '@ai-life-manager/ledger-entries/v1';
const BUDGET_KEY = '@ai-life-manager/ledger-budget/v1';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('家計簿の記録の保存', () => {
  it('保存データがなければ空の一覧を返す', async () => {
    await expect(loadEntries()).resolves.toEqual([]);
  });

  it('保存した一覧をそのまま読み込める', async () => {
    const entries = [
      makeEntry({ id: 'a', note: 'ランチ' }),
      makeEntry({ id: 'b', type: 'income', amount: 250000, category: 'salary' }),
    ];
    await saveEntries(entries);
    await expect(loadEntries()).resolves.toEqual(entries);
  });

  it('壊れたデータや配列でないデータは例外にする（上書き防止のため）', async () => {
    await AsyncStorage.setItem(ENTRIES_KEY, '{broken');
    await expect(loadEntries()).rejects.toThrow();
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify({}));
    await expect(loadEntries()).rejects.toThrow('保存データの形式が正しくありません');
  });

  it('金額・日付・種類が不正な項目は読み飛ばす', async () => {
    await AsyncStorage.setItem(
      ENTRIES_KEY,
      JSON.stringify([
        makeEntry({ id: 'ok' }),
        { ...makeEntry({ id: 'zero' }), amount: 0 },
        { ...makeEntry({ id: 'float' }), amount: 1.5 },
        { ...makeEntry({ id: 'big' }), amount: 10_000_001 },
        { ...makeEntry({ id: 'date' }), date: '11/10' },
        { ...makeEntry({ id: 'type' }), type: 'transfer' },
        { amount: 100 },
        null,
      ]),
    );
    const loaded = await loadEntries();
    expect(loaded.map((e) => e.id)).toEqual(['ok']);
  });

  it('種類と合わないカテゴリは「その他」に寄せ、欠けた項目は補う', async () => {
    await AsyncStorage.setItem(
      ENTRIES_KEY,
      JSON.stringify([
        { id: 'a', type: 'expense', date: '2026-11-10', amount: 100, category: 'salary' },
        { id: 'b', type: 'income', date: '2026-11-10', amount: 100, category: 'food' },
      ]),
    );
    const [a, b] = await loadEntries();
    expect(a).toMatchObject({ category: 'other', note: '' });
    expect(b).toMatchObject({ category: 'other_income' });
    expect(a.updatedAt).toBe(a.createdAt);
  });
});

describe('予算の保存', () => {
  it('未設定なら null', async () => {
    await expect(loadBudget()).resolves.toBeNull();
  });

  it('保存した予算を読み込め、null で設定を消せる', async () => {
    await saveBudget(80000);
    await expect(loadBudget()).resolves.toBe(80000);
    await saveBudget(null);
    await expect(loadBudget()).resolves.toBeNull();
    await expect(AsyncStorage.getItem(BUDGET_KEY)).resolves.toBeNull();
  });

  it('不正な値は例外にする（上書き防止のため）', async () => {
    await AsyncStorage.setItem(BUDGET_KEY, JSON.stringify(-1));
    await expect(loadBudget()).rejects.toThrow();
  });
});
