import {
  defaultDateForMonth,
  formatDayHeading,
  formatMonth,
  formatYen,
  getBudgetStatus,
  groupByDate,
  parseAmount,
  sanitizeAmountInput,
  shiftMonth,
  summarizeMonth,
  toMonthKey,
} from '@/utils/ledger';

import { makeEntry } from './helpers';

describe('月の扱い', () => {
  it('toMonthKey は日付から年月を取り出す', () => {
    expect(toMonthKey('2026-11-10')).toBe('2026-11');
  });

  it('shiftMonth は年をまたいで前後に移動できる', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-03', -14)).toBe('2025-01');
  });

  it('formatMonth / formatDayHeading は日本語で表示する', () => {
    expect(formatMonth('2026-01')).toBe('2026年1月');
    expect(formatDayHeading('2026-11-10')).toBe('11月10日（火）');
  });

  it('defaultDateForMonth は今月なら今日、別の月ならその月の 1 日', () => {
    expect(defaultDateForMonth('2026-11', '2026-11-10')).toBe('2026-11-10');
    expect(defaultDateForMonth('2026-10', '2026-11-10')).toBe('2026-10-01');
  });
});

describe('金額の扱い', () => {
  it('formatYen は 3 桁区切りで表示し、負の値にも対応する', () => {
    expect(formatYen(0)).toBe('¥0');
    expect(formatYen(980)).toBe('¥980');
    expect(formatYen(1234567)).toBe('¥1,234,567');
    expect(formatYen(-5000)).toBe('-¥5,000');
  });

  it('parseAmount は 1〜1,000 万円の整数だけを受け付ける', () => {
    expect(parseAmount('1500')).toBe(1500);
    expect(parseAmount('1,500円')).toBe(1500);
    expect(parseAmount('¥１２３')).toBe(123);
    expect(parseAmount('10000000')).toBe(10_000_000);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('10000001')).toBeNull();
    expect(parseAmount('12.5')).toBeNull();
    expect(parseAmount('-100')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });

  it('sanitizeAmountInput は数字以外と先頭の 0 を取り除く', () => {
    expect(sanitizeAmountInput('1,2a3')).toBe('123');
    expect(sanitizeAmountInput('００５')).toBe('5');
    expect(sanitizeAmountInput('0')).toBe('0');
    expect(sanitizeAmountInput('123456789012')).toBe('12345678');
  });
});

describe('summarizeMonth', () => {
  const entries = [
    makeEntry({ id: 'a', date: '2026-11-01', amount: 3000, category: 'food' }),
    makeEntry({ id: 'b', date: '2026-11-15', amount: 1000, category: 'food' }),
    makeEntry({ id: 'c', date: '2026-11-20', amount: 6000, category: 'housing' }),
    makeEntry({ id: 'd', date: '2026-11-25', type: 'income', amount: 250000, category: 'salary' }),
    makeEntry({ id: 'e', date: '2026-10-31', amount: 99999, category: 'food' }),
    makeEntry({ id: 'f', date: '2026-12-01', amount: 99999, category: 'food' }),
  ];

  it('その月の収入・支出・収支・件数を集計する（他の月は含めない）', () => {
    const summary = summarizeMonth(entries, '2026-11');
    expect(summary).toMatchObject({ income: 250000, expense: 10000, balance: 240000, count: 4 });
  });

  it('支出のカテゴリ別合計を金額の大きい順に返し、収入は含めない', () => {
    const { expenseByCategory } = summarizeMonth(entries, '2026-11');
    expect(
      expenseByCategory.map(({ category, amount, ratio }) => [category.key, amount, ratio]),
    ).toEqual([
      ['housing', 6000, 0.6],
      ['food', 4000, 0.4],
    ]);
  });

  it('記録がない月はすべて 0', () => {
    expect(summarizeMonth(entries, '2025-01')).toEqual({
      income: 0,
      expense: 0,
      balance: 0,
      count: 0,
      expenseByCategory: [],
    });
  });

  it('支出が収入より多ければ収支はマイナス', () => {
    expect(summarizeMonth([makeEntry({ amount: 500 })], '2026-11').balance).toBe(-500);
  });
});

describe('groupByDate', () => {
  it('日付の新しい順にまとめ、同じ日の中は登録の新しい順に並べる', () => {
    const entries = [
      makeEntry({ id: 'old', date: '2026-11-10', createdAt: '2026-11-10T01:00:00.000Z' }),
      makeEntry({ id: 'early', date: '2026-11-02' }),
      makeEntry({ id: 'new', date: '2026-11-10', createdAt: '2026-11-10T09:00:00.000Z' }),
      makeEntry({ id: 'other-month', date: '2026-12-01' }),
    ];
    const groups = groupByDate(entries, '2026-11');
    expect(groups.map((g) => [g.date, g.entries.map((e) => e.id)])).toEqual([
      ['2026-11-10', ['new', 'old']],
      ['2026-11-02', ['early']],
    ]);
  });

  it('日ごとの支出と収入の合計を出す', () => {
    const entries = [
      makeEntry({ id: 'a', amount: 300 }),
      makeEntry({ id: 'b', amount: 700 }),
      makeEntry({ id: 'c', type: 'income', amount: 5000, category: 'side' }),
    ];
    const [day] = groupByDate(entries, '2026-11');
    expect([day.expense, day.income]).toEqual([1000, 5000]);
  });
});

describe('getBudgetStatus', () => {
  it('残額と使用率を計算する', () => {
    expect(getBudgetStatus(100000, 25000)).toEqual({
      budget: 100000,
      spent: 25000,
      remaining: 75000,
      ratio: 0.25,
      isOver: false,
    });
  });

  it('ちょうど使い切ったときは超過ではない', () => {
    expect(getBudgetStatus(1000, 1000)).toMatchObject({ remaining: 0, isOver: false });
  });

  it('予算を超えたら超過になり、残額はマイナス', () => {
    expect(getBudgetStatus(1000, 1500)).toMatchObject({ remaining: -500, ratio: 1.5, isOver: true });
  });
});
