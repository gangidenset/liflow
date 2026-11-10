export type EntryType = 'expense' | 'income';

export type ExpenseCategory =
  | 'food'
  | 'daily'
  | 'transport'
  | 'housing'
  | 'utilities'
  | 'medical'
  | 'entertainment'
  | 'clothing'
  | 'social'
  | 'other';

export type IncomeCategory = 'salary' | 'bonus' | 'side' | 'other_income';

export type LedgerCategory = ExpenseCategory | IncomeCategory;

/** 家計簿の 1 件の記録（支出または収入） */
export interface LedgerEntry {
  id: string;
  type: EntryType;
  /** 'YYYY-MM-DD'（端末のローカル日付） */
  date: string;
  /** 円（1 以上の整数） */
  amount: number;
  category: LedgerCategory;
  note: string;
  createdAt: string;
  updatedAt: string;
}

/** 登録・編集フォームで入力する項目 */
export type LedgerEntryInput = Pick<LedgerEntry, 'type' | 'date' | 'amount' | 'category' | 'note'>;

export type CategoryInfo<K extends LedgerCategory = LedgerCategory> = {
  key: K;
  label: string;
  color: string;
};

export const EXPENSE_CATEGORIES: readonly CategoryInfo<ExpenseCategory>[] = [
  { key: 'food', label: '食費', color: '#E0703A' },
  { key: 'daily', label: '日用品', color: '#3FA37A' },
  { key: 'transport', label: '交通', color: '#3B82D6' },
  { key: 'housing', label: '住居', color: '#7A5AD6' },
  { key: 'utilities', label: '光熱・通信', color: '#D9A00B' },
  { key: 'medical', label: '医療', color: '#D93A6A' },
  { key: 'entertainment', label: '娯楽', color: '#1FA6B8' },
  { key: 'clothing', label: '衣服', color: '#B8649E' },
  { key: 'social', label: '交際', color: '#8A9A2E' },
  { key: 'other', label: 'その他', color: '#8D93A6' },
];

export const INCOME_CATEGORIES: readonly CategoryInfo<IncomeCategory>[] = [
  { key: 'salary', label: '給与', color: '#1E9E6A' },
  { key: 'bonus', label: '賞与', color: '#2F8F9D' },
  { key: 'side', label: '副収入', color: '#5A8F3A' },
  { key: 'other_income', label: 'その他', color: '#8D93A6' },
];

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  expense: '支出',
  income: '収入',
};

/** 金額の上限（円） */
export const MAX_AMOUNT = 10_000_000;

export function categoriesFor(type: EntryType): readonly CategoryInfo[] {
  return type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
}

export function getCategoryInfo(category: LedgerCategory): CategoryInfo {
  return (
    EXPENSE_CATEGORIES.find((c) => c.key === category) ??
    INCOME_CATEGORIES.find((c) => c.key === category) ??
    EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
  );
}

/** その種類（支出・収入）で選べるカテゴリか */
export function isCategoryOf(type: EntryType, category: unknown): category is LedgerCategory {
  return categoriesFor(type).some((c) => c.key === category);
}

export function defaultCategoryFor(type: EntryType): LedgerCategory {
  return type === 'expense' ? 'food' : 'salary';
}
