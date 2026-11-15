import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useLedger } from '@/context/LedgerContext';
import { useTasks } from '@/context/TaskContext';
import { supabase } from '@/lib/supabase';
import { clearSyncMeta, loadSyncMeta, saveSyncMeta } from '@/storage/syncMetaStorage';
import { createSupabaseRemote } from '@/sync/supabaseRemote';
import {
  countPending,
  pendingRecords,
  runSync,
  type AnySyncCollection,
} from '@/sync/syncEngine';
import { budgetRecords, createSyncMeta, type SyncMeta } from '@/sync/types';
import { INITIAL_BUDGET } from '@/types/ledger';

/** 手元で変更してから同期を始めるまでの待ち時間（続けて操作したときにまとめて送るため） */
const SYNC_DELAY_MS = 2000;

export type SyncStatus = 'idle' | 'syncing' | 'error';

type SyncContextValue = {
  status: SyncStatus;
  /** 最後に同期を完了した日時 */
  lastSyncedAt: string | null;
  /** 直近の同期が失敗したときのメッセージ */
  errorMessage: string | null;
  /** まだアカウントに送っていない変更の件数 */
  pendingCount: number;
  /** すぐに同期する。成功したら true */
  syncNow: () => Promise<boolean>;
  /**
   * ログアウトして端末内のデータを消す。未送信の変更を送れなかった場合は、
   * force でなければ何もせず 'unsynced' を返す。
   */
  logout: (options?: { force?: boolean }) => Promise<'done' | 'unsynced'>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

function describeSyncError(error: unknown): string {
  // supabase-js のデータベースの失敗は Error ではなく { message } の形で返る
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  if (/fetch|network|Failed to/i.test(message)) {
    return '通信できなかったため、同期できませんでした。電波のよい場所で、もう一度お試しください。';
  }
  return '同期できませんでした。時間をおいて、もう一度お試しください。';
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  const { allTasks, isLoaded: tasksLoaded, mergeTasks, resetTasks } = useTasks();
  const {
    allEntries,
    budgetSetting,
    isLoaded: ledgerLoaded,
    mergeLedger,
    resetLedger,
  } = useLedger();
  const userId = session?.user.id ?? null;
  const isDataLoaded = tasksLoaded && ledgerLoaded;

  const [meta, setMeta] = useState<SyncMeta | null>(null);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 同期の処理は非同期に進むため、最新の値を ref から読む
  const tasksRef = useRef(allTasks);
  const entriesRef = useRef(allEntries);
  const budgetRef = useRef(budgetSetting);
  const metaRef = useRef<SyncMeta | null>(null);
  const userIdRef = useRef(userId);
  const runningRef = useRef<Promise<boolean> | null>(null);
  const rerunRef = useRef(false);
  useEffect(() => {
    tasksRef.current = allTasks;
    entriesRef.current = allEntries;
    budgetRef.current = budgetSetting;
    userIdRef.current = userId;
  }, [allTasks, allEntries, budgetSetting, userId]);

  const collections = useMemo<AnySyncCollection[]>(
    () => [
      { table: 'tasks', getLocal: () => tasksRef.current, apply: mergeTasks },
      { table: 'ledger_entries', getLocal: () => entriesRef.current, apply: (r) => mergeLedger(r, null) },
      {
        table: 'user_settings',
        getLocal: () => budgetRecords(budgetRef.current, INITIAL_BUDGET.updatedAt),
        apply: (records) => {
          const latest = records[records.length - 1];
          if (latest) mergeLedger([], { amount: latest.amount, updatedAt: latest.updatedAt });
        },
      },
    ],
    [mergeTasks, mergeLedger],
  );

  const updateMeta = useCallback((next: SyncMeta | null) => {
    metaRef.current = next;
    setMeta(next);
  }, []);

  const syncOnce = useCallback(async (): Promise<boolean> => {
    const currentUser = userIdRef.current;
    const currentMeta = metaRef.current;
    if (!supabase || !currentUser || !currentMeta || currentMeta.userId !== currentUser) return false;
    setStatus('syncing');
    try {
      const next = await runSync(createSupabaseRemote(supabase, currentUser), collections, currentMeta);
      // 同期中にログアウトしていたら結果を捨てる
      if (userIdRef.current !== currentUser) return false;
      updateMeta(next);
      await saveSyncMeta(next);
      setErrorMessage(null);
      setStatus('idle');
      return true;
    } catch (error) {
      console.warn('Sync failed', error);
      if (userIdRef.current === currentUser) {
        setErrorMessage(describeSyncError(error));
        setStatus('error');
      }
      return false;
    }
  }, [collections, updateMeta]);

  /** 同期中に呼ばれたら、終わった後にもう一度同期する（失敗していたら、やり直さない） */
  const syncNow = useCallback((): Promise<boolean> => {
    if (runningRef.current) {
      rerunRef.current = true;
      return runningRef.current;
    }
    const run = (async () => {
      let ok = await syncOnce();
      // 失敗した直後にやり直しても同じ結果になりやすいので、成功したときだけ続ける
      while (rerunRef.current && ok) {
        rerunRef.current = false;
        ok = await syncOnce();
      }
      rerunRef.current = false;
      return ok;
    })().finally(() => {
      runningRef.current = null;
    });
    runningRef.current = run;
    return run;
  }, [syncOnce]);

  // ログインしたら、同期の進み具合を用意して同期する
  useEffect(() => {
    if (!userId || !isDataLoaded) return;
    let cancelled = false;
    (async () => {
      const saved = await loadSyncMeta();
      if (cancelled) return;
      if (saved && saved.userId !== userId) {
        // 端末に残っていたのは別のアカウントのデータ。混ざらないように消してから始める
        resetTasks();
        resetLedger();
        tasksRef.current = [];
        entriesRef.current = [];
        budgetRef.current = INITIAL_BUDGET;
      }
      // 初めてのログインなら、端末内のデータをそのアカウントに取り込む
      updateMeta(saved && saved.userId === userId ? saved : createSyncMeta(userId));
      void syncNow();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isDataLoaded, resetTasks, resetLedger, updateMeta, syncNow]);

  // ログアウト後に古い進み具合が残っていても使わない
  const activeMeta = meta && meta.userId === userId ? meta : null;

  const pendingCount = useMemo(() => {
    if (!activeMeta) return 0;
    const { tables } = activeMeta;
    return (
      pendingRecords(allTasks, tables.tasks).length +
      pendingRecords(allEntries, tables.ledger_entries).length +
      pendingRecords(budgetRecords(budgetSetting, INITIAL_BUDGET.updatedAt), tables.user_settings)
        .length
    );
  }, [activeMeta, allTasks, allEntries, budgetSetting]);

  // 手元で変更があったら、少し待ってから同期する
  useEffect(() => {
    if (!activeMeta || pendingCount === 0) return;
    const timer = setTimeout(() => void syncNow(), SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [activeMeta, pendingCount, allTasks, allEntries, budgetSetting, syncNow]);

  // アプリを開き直したら同期する（他の端末での変更を受け取る）
  useEffect(() => {
    if (!userId) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && metaRef.current) void syncNow();
    });
    return () => subscription.remove();
  }, [userId, syncNow]);

  const logout = useCallback(
    async (options?: { force?: boolean }): Promise<'done' | 'unsynced'> => {
      const currentMeta = metaRef.current;
      if (currentMeta && countPending(collections, currentMeta) > 0) {
        await syncNow();
        const latest = metaRef.current;
        if (!options?.force && latest && countPending(collections, latest) > 0) return 'unsynced';
      }
      await signOut();
      userIdRef.current = null;
      updateMeta(null);
      resetTasks();
      resetLedger();
      await clearSyncMeta();
      setErrorMessage(null);
      setStatus('idle');
      return 'done';
    },
    [collections, syncNow, signOut, updateMeta, resetTasks, resetLedger],
  );

  const value = useMemo(
    () => ({
      status,
      lastSyncedAt: activeMeta?.lastSyncedAt ?? null,
      errorMessage,
      pendingCount,
      syncNow,
      logout,
    }),
    [status, activeMeta, errorMessage, pendingCount, syncNow, logout],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync は SyncProvider の内側で使用してください');
  return value;
}
