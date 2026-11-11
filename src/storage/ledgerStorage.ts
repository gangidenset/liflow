import AsyncStorage from '@react-native-async-storage/async-storage';

import { isCategoryOf, MAX_AMOUNT, type EntryType, type LedgerEntry } from '@/types/ledger';

const ENTRIES_KEY = '@ai-life-manager/ledger-entries/v1';
const BUDGET_KEY = '@ai-life-manager/ledger-budget/v1';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_AMOUNT;
}

/** 保存データを 1 件ずつ検証し、復元できない項目は読み飛ばす。 */
function toEntry(value: unknown): LedgerEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string') return null;
  if (v.type !== 'expense' && v.type !== 'income') return null;
  if (typeof v.date !== 'string' || !DATE_KEY_PATTERN.test(v.date)) return null;
  if (!isValidAmount(v.amount)) return null;

  const type: EntryType = v.type;
  const now = new Date().toISOString();
  const createdAt = typeof v.createdAt === 'string' ? v.createdAt : now;
  return {
    id: v.id,
    type,
    date: v.date,
    amount: v.amount,
    // 種類と合わないカテゴリは「その他」に寄せる
    category: isCategoryOf(type, v.category) ? v.category : type === 'expense' ? 'other' : 'other_income',
    note: typeof v.note === 'string' ? v.note : '',
    createdAt,
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : createdAt,
  };
}

export async function loadEntries(): Promise<LedgerEntry[]> {
  const raw = await AsyncStorage.getItem(ENTRIES_KEY);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('保存データの形式が正しくありません');
  }
  return parsed.map(toEntry).filter((entry): entry is LedgerEntry => entry !== null);
}

export async function saveEntries(entries: readonly LedgerEntry[]): Promise<void> {
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

/** 1 か月の支出予算（円）。未設定は null。 */
export async function loadBudget(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(BUDGET_KEY);
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null) return null;
  if (!isValidAmount(parsed)) {
    throw new Error('予算の保存データが正しくありません');
  }
  return parsed;
}

export async function saveBudget(budget: number | null): Promise<void> {
  if (budget === null) {
    await AsyncStorage.removeItem(BUDGET_KEY);
    return;
  }
  await AsyncStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
}
