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
import type { LedgerEntry, LedgerEntryInput } from '@/types/ledger';

export type LedgerAction =
  | { type: 'loaded'; entries: LedgerEntry[] }
  | { type: 'added'; entry: LedgerEntry }
  | { type: 'updated'; id: string; input: LedgerEntryInput; now: string }
  | { type: 'deleted'; id: string };

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
      return state.filter((entry) => entry.id !== action.id);
  }
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalize(input: LedgerEntryInput): LedgerEntryInput {
  return { ...input, note: input.note.trim() };
}

type LedgerContextValue = {
  entries: LedgerEntry[];
  /** 1 か月の支出予算（円）。未設定は null */
  budget: number | null;
  /** 保存済みデータの読み込みが終わったか */
  isLoaded: boolean;
  /** 読み込み・保存に失敗したときのメッセージ */
  storageError: string | null;
  addEntry: (input: LedgerEntryInput) => void;
  updateEntry: (id: string, input: LedgerEntryInput) => void;
  deleteEntry: (id: string) => void;
  setBudget: (budget: number | null) => void;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [entries, dispatch] = useReducer(ledgerReducer, []);
  const [budget, setBudgetState] = useState<number | null>(null);
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
          setBudgetState(budgetResult.value);
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
    saveEntries(entries).catch((error: unknown) => {
      console.warn('Failed to save ledger entries', error);
      setStorageError('家計簿を保存できませんでした。端末の空き容量を確認してください。');
    });
  }, [entries, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !canSaveBudget.current) return;
    saveBudget(budget).catch((error: unknown) => {
      console.warn('Failed to save budget', error);
      setStorageError('予算を保存できませんでした。端末の空き容量を確認してください。');
    });
  }, [budget, isLoaded]);

  const addEntry = useCallback((input: LedgerEntryInput) => {
    const now = new Date().toISOString();
    dispatch({
      type: 'added',
      entry: { id: createId(), ...normalize(input), createdAt: now, updatedAt: now },
    });
  }, []);

  const updateEntry = useCallback((id: string, input: LedgerEntryInput) => {
    dispatch({ type: 'updated', id, input: normalize(input), now: new Date().toISOString() });
  }, []);

  const deleteEntry = useCallback((id: string) => {
    dispatch({ type: 'deleted', id });
  }, []);

  const setBudget = useCallback((value: number | null) => {
    setBudgetState(value);
  }, []);

  const value = useMemo(
    () => ({
      entries,
      budget,
      isLoaded,
      storageError,
      addEntry,
      updateEntry,
      deleteEntry,
      setBudget,
    }),
    [entries, budget, isLoaded, storageError, addEntry, updateEntry, deleteEntry, setBudget],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const value = useContext(LedgerContext);
  if (!value) throw new Error('useLedger は LedgerProvider の内側で使用してください');
  return value;
}
