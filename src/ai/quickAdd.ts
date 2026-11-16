import { callAi } from '@/ai/aiClient';
import { isCategoryOf, MAX_AMOUNT, type LedgerCategory } from '@/types/ledger';
import type { Priority } from '@/types/task';

/** 入力できる文章の最大文字数（サーバー側と同じ） */
export const QUICK_ADD_MAX_TEXT = 1000;

export type TaskDraft = {
  kind: 'task';
  title: string;
  note: string;
  dueDate: string | null;
  priority: Priority;
};

export type LedgerDraft = {
  kind: 'expense' | 'income';
  amount: number;
  date: string;
  category: LedgerCategory;
  note: string;
};

export type Draft = TaskDraft | LedgerDraft;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low'];

/**
 * サーバーから届いた下書きを、もう一度検査する（サーバーでも検査済みだが、
 * アプリに保存する前の最後の確認として、形の合わないものは捨てる）。
 */
export function parseDrafts(raw: unknown): Draft[] {
  const items = (raw as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  const drafts: Draft[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const v = item as Record<string, unknown>;
    const note = typeof v.note === 'string' ? v.note : '';
    if (v.kind === 'task') {
      if (typeof v.title !== 'string' || v.title.trim() === '') continue;
      drafts.push({
        kind: 'task',
        title: v.title,
        note,
        dueDate: typeof v.dueDate === 'string' && DATE_KEY_PATTERN.test(v.dueDate) ? v.dueDate : null,
        priority: PRIORITIES.includes(v.priority as Priority) ? (v.priority as Priority) : 'medium',
      });
    } else if (v.kind === 'expense' || v.kind === 'income') {
      const amount = v.amount;
      if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
        continue;
      }
      if (typeof v.date !== 'string' || !DATE_KEY_PATTERN.test(v.date)) continue;
      if (!isCategoryOf(v.kind, v.category)) continue;
      drafts.push({ kind: v.kind, amount, date: v.date, category: v.category, note });
    }
  }
  return drafts;
}

/** 文章を AI に送り、タスク・家計簿の下書きを受け取る */
export async function requestQuickAdd(text: string): Promise<Draft[]> {
  const data = await callAi<unknown>('quick_add', { text });
  return parseDrafts(data);
}
