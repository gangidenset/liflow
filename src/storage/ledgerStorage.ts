import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  INITIAL_BUDGET,
  isCategoryOf,
  MAX_AMOUNT,
  type BudgetSetting,
  type EntryType,
  type LedgerEntry,
} from '@/types/ledger';

const ENTRIES_KEY = '@ai-life-manager/ledger-entries/v1';
const BUDGET_KEY = '@ai-life-manager/ledger-budget/v1';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_AMOUNT;
}

/** 保存データ・同期データを 1 件ずつ検証する。復元できない項目は null。 */
export function parseLedgerEntry(value: unknown): LedgerEntry | null {
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
    // 同期対応前のデータには無いため、未削除として扱う
    deletedAt: typeof v.deletedAt === 'string' ? v.deletedAt : null,
  };
}

export async function loadEntries(): Promise<LedgerEntry[]> {
  const raw = await AsyncStorage.getItem(ENTRIES_KEY);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('保存データの形式が正しくありません');
  }
  return parsed.map(parseLedgerEntry).filter((entry): entry is LedgerEntry => entry !== null);
}

export async function saveEntries(entries: readonly LedgerEntry[]): Promise<void> {
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

/** 1 か月の支出予算の設定。保存データがなければ未設定。 */
export async function loadBudget(): Promise<BudgetSetting> {
  const raw = await AsyncStorage.getItem(BUDGET_KEY);
  if (raw === null) return INITIAL_BUDGET;
  const parsed: unknown = JSON.parse(raw);
  // 同期対応前は金額だけを保存していた。変更日時は不明なので最も古い扱いにする
  if (isValidAmount(parsed)) return { amount: parsed, updatedAt: INITIAL_BUDGET.updatedAt };
  if (typeof parsed === 'object' && parsed !== null) {
    const v = parsed as Record<string, unknown>;
    if ((v.amount === null || isValidAmount(v.amount)) && typeof v.updatedAt === 'string') {
      return { amount: v.amount, updatedAt: v.updatedAt };
    }
  }
  throw new Error('予算の保存データが正しくありません');
}

export async function saveBudget(budget: BudgetSetting): Promise<void> {
  await AsyncStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
}

/** 家計簿の記録と予算を端末から消す。 */
export async function clearLedger(): Promise<void> {
  await AsyncStorage.multiRemove([ENTRIES_KEY, BUDGET_KEY]);
}
