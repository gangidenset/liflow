import {
  getCategoryInfo,
  MAX_AMOUNT,
  type CategoryInfo,
  type LedgerEntry,
} from '@/types/ledger';
import { fromDateKey } from '@/utils/date';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** 'YYYY-MM-DD' から 'YYYY-MM' を取り出す。 */
export function toMonthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

/** 'YYYY-MM' を delta か月ずらす。 */
export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const index = y * 12 + (m - 1) + delta;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** 例: 2026年11月 */
export function formatMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${y}年${m}月`;
}

/** 例: 11月10日（火） */
export function formatDayHeading(dateKey: string): string {
  const date = fromDateKey(dateKey);
  return `${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAYS[date.getDay()]}）`;
}

/** 例: 1234567 → ¥1,234,567、-500 → -¥500 */
export function formatYen(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const digits = String(Math.abs(Math.round(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}¥${digits}`;
}

/**
 * 入力された金額の文字列を整数の円にする。
 * 全角数字・カンマ・「円」「¥」は許容し、1〜上限の整数でなければ null。
 */
export function parseAmount(text: string): number | null {
  const normalized = text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，\s円¥￥]/g, '');
  if (!/^\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_AMOUNT) return null;
  return value;
}

/** 入力欄に表示する用に、数字以外を取り除く（全角数字は半角にする）。 */
export function sanitizeAmountInput(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, String(MAX_AMOUNT).length);
}

export function entriesInMonth(entries: readonly LedgerEntry[], monthKey: string): LedgerEntry[] {
  return entries.filter((entry) => toMonthKey(entry.date) === monthKey);
}

export type CategoryTotal = {
  category: CategoryInfo;
  amount: number;
  /** 支出合計に占める割合（0〜1） */
  ratio: number;
};

export type MonthSummary = {
  income: number;
  expense: number;
  /** 収入 − 支出 */
  balance: number;
  count: number;
  /** 支出のカテゴリ別合計（金額の大きい順） */
  expenseByCategory: CategoryTotal[];
};

export function summarizeMonth(entries: readonly LedgerEntry[], monthKey: string): MonthSummary {
  let income = 0;
  let expense = 0;
  const byCategory = new Map<string, number>();
  const inMonth = entriesInMonth(entries, monthKey);

  for (const entry of inMonth) {
    if (entry.type === 'income') {
      income += entry.amount;
    } else {
      expense += entry.amount;
      byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.amount);
    }
  }

  const expenseByCategory = [...byCategory.entries()]
    .map(([category, amount]) => ({
      category: getCategoryInfo(category as LedgerEntry['category']),
      amount,
      ratio: expense === 0 ? 0 : amount / expense,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { income, expense, balance: income - expense, count: inMonth.length, expenseByCategory };
}

export type DayGroup = {
  date: string;
  entries: LedgerEntry[];
  expense: number;
  income: number;
};

/** その月の記録を日付ごとにまとめる。日付は新しい順、同じ日の中は登録の新しい順。 */
export function groupByDate(entries: readonly LedgerEntry[], monthKey: string): DayGroup[] {
  const groups = new Map<string, LedgerEntry[]>();
  for (const entry of entriesInMonth(entries, monthKey)) {
    const list = groups.get(entry.date) ?? [];
    list.push(entry);
    groups.set(entry.date, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => {
      const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        date,
        entries: sorted,
        expense: sorted.filter((e) => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0),
        income: sorted.filter((e) => e.type === 'income').reduce((sum, e) => sum + e.amount, 0),
      };
    });
}

export type BudgetStatus = {
  budget: number;
  spent: number;
  /** 予算 − 支出（超過時は負の値） */
  remaining: number;
  /** 予算の使用率（0 以上。超過時は 1 を超える） */
  ratio: number;
  isOver: boolean;
};

export function getBudgetStatus(budget: number, spent: number): BudgetStatus {
  const remaining = budget - spent;
  return {
    budget,
    spent,
    remaining,
    ratio: budget > 0 ? spent / budget : 0,
    isOver: remaining < 0,
  };
}

/**
 * 記録を追加するときの日付の初期値。
 * 表示中の月が今月なら今日、別の月ならその月の 1 日。
 */
export function defaultDateForMonth(monthKey: string, todayKey: string): string {
  return toMonthKey(todayKey) === monthKey ? todayKey : `${monthKey}-01`;
}
