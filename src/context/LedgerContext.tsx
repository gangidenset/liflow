import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { loadBudget, loadEntries, saveBudget, saveEntries } from '@/storage/ledgerStorage';
import { isNewer, mergeById, withoutDeleted } from '@/sync/merge';
import {
  INITIAL_BUDGET,
  type BudgetSetting,
  type LedgerEntry,
  type LedgerEntryInput,
} from '@/types/ledger';

export type LedgerAction =
  | { type: 'loaded'; entries: LedgerEntry[] }
  | { type: 'added'; entry: LedgerEntry }
  | { type: 'updated'; id: string; input: LedgerEntryInput; now: string }
  | { type: 'deleted'; id: string; now: string }
  /** 同期で受け取った記録を取り込む（新しい方を残す） */
  | { type: 'merged'; entries: LedgerEntry[] }
  /** すべて消す（ログアウト時） */
  | { type: 'reset' };

export function ledgerReducer(state: LedgerEntry[], action: LedgerAction): LedgerEntry[] {
  switch (action.type) {
    case 'loaded':
      return action.entries;
    case 'added':
      return [action.entry, ...state];
    case 'updated':
      return state.map((entry) =>
        entry.id === action.id ? { ...entry, ...action.input, updatedAt: action.now } : entry,
      );
    case 'deleted':
      // 記録は残して削除日時を付ける（同期で他の端末に削除を伝えるため）
      return state.map((entry) =>
        entry.id === action.id ? { ...entry, deletedAt: action.now, updatedAt: action.now } : entry,
      );
    case 'merged':
      return mergeById(state, action.entries);
    case 'reset':
      return [];
  }
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalize(input: LedgerEntryInput): LedgerEntryInput {
  return { ...input, note: input.note.trim() };
}

type LedgerContextValue = {
  /** 画面に出す記録（削除済みを除く） */
  entries: LedgerEntry[];
  /** 削除済みも含むすべての記録（同期用） */
  allEntries: LedgerEntry[];
  /** 1 か月の支出予算（円）。未設定は null */
  budget: number | null;
  /** 予算の設定（変更日時つき、同期用） */
  budgetSetting: BudgetSetting;
  /** 保存済みデータの読み込みが終わったか */
  isLoaded: boolean;
  /** 読み込み・保存に失敗したときのメッセージ */
  storageError: string | null;
  addEntry: (input: LedgerEntryInput) => void;
  updateEntry: (id: string, input: LedgerEntryInput) => void;
  deleteEntry: (id: string) => void;
  setBudget: (budget: number | null) => void;
  /** 同期で受け取った記録と予算を取り込む（それぞれ新しい方を残す） */
  mergeLedger: (entries: LedgerEntry[], budget: BudgetSetting | null) => void;
  /** 端末内の家計簿をすべて消す */
  resetLedger: () => void;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [allEntries, dispatch] = useReducer(ledgerReducer, []);
  const [budgetSetting, setBudgetSetting] = useState<BudgetSetting>(INITIAL_BUDGET);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  /** 読み込みに失敗した場合、既存の保存データを空の状態で上書きしないために保存を止める */
  const canSaveEntries = useRef(false);
  const canSaveBudget = useRef(false);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([loadEntries(), loadBudget()])
      .then(([entriesResult, budgetResult]) => {
        if (cancelled) return;
        if (entriesResult.status === 'fulfilled') {
          dispatch({ type: 'loaded', entries: entriesResult.value });
          canSaveEntries.current = true;
        } else {
          console.warn('Failed to load ledger entries', entriesResult.reason);
        }
        if (budgetResult.status === 'fulfilled') {
          setBudgetSetting(budgetResult.value);
          canSaveBudget.current = true;
        } else {
          console.warn('Failed to load budget', budgetResult.reason);
        }
        if (entriesResult.status === 'rejected' || budgetResult.status === 'rejected') {
          setStorageError('家計簿のデータを読み込めませんでした。アプリを再起動してください。');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !canSaveEntries.current) return;
    saveEntries(allEntries).catch((error: unknown) => {
      console.warn('Failed to save ledger entries', error);
      setStorageError('家計簿を保存できませんでした。端末の空き容量を確認してください。');
    });
  }, [allEntries, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !canSaveBudget.current) return;
    saveBudget(budgetSetting).catch((error: unknown) => {
      console.warn('Failed to save budget', error);
      setStorageError('予算を保存できませんでした。端末の空き容量を確認してください。');
    });
  }, [budgetSetting, isLoaded]);

  const addEntry = useCallback((input: LedgerEntryInput) => {
    const now = new Date().toISOString();
    dispatch({
      type: 'added',
      entry: { id: createId(), ...normalize(input), createdAt: now, updatedAt: now, deletedAt: null },
    });
  }, []);

  const updateEntry = useCallback((id: string, input: LedgerEntryInput) => {
    dispatch({ type: 'updated', id, input: normalize(input), now: new Date().toISOString() });
  }, []);

  const deleteEntry = useCallback((id: string) => {
    dispatch({ type: 'deleted', id, now: new Date().toISOString() });
  }, []);

  const setBudget = useCallback((amount: number | null) => {
    setBudgetSetting({ amount, updatedAt: new Date().toISOString() });
  }, []);

  const mergeLedger = useCallback((entries: LedgerEntry[], budget: BudgetSetting | null) => {
    dispatch({ type: 'merged', entries });
    if (budget) {
      setBudgetSetting((current) => (isNewer(budget, current) ? budget : current));
    }
  }, []);

  const resetLedger = useCallback(() => {
    // 読み込みに失敗していた場合も、明示的に消すときは保存を再開する
    canSaveEntries.current = true;
    canSaveBudget.current = true;
    setStorageError(null);
    dispatch({ type: 'reset' });
    setBudgetSetting(INITIAL_BUDGET);
  }, []);

  const entries = useMemo(() => withoutDeleted(allEntries), [allEntries]);

  const value = useMemo(
    () => ({
      entries,
      allEntries,
      budget: budgetSetting.amount,
      budgetSetting,
      isLoaded,
      storageError,
      addEntry,
      updateEntry,
      deleteEntry,
      setBudget,
      mergeLedger,
      resetLedger,
    }),
    [
      entries,
      allEntries,
      budgetSetting,
      isLoaded,
      storageError,
      addEntry,
      updateEntry,
      deleteEntry,
      setBudget,
      mergeLedger,
      resetLedger,
    ],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const value = useContext(LedgerContext);
  if (!value) throw new Error('useLedger は LedgerProvider の内側で使用してください');
  return value;
}
