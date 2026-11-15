import type { BudgetSetting, LedgerEntry } from '@/types/ledger';
import type { Task } from '@/types/task';

import type { SyncRecord } from './merge';

/** 予算を同期の記録として扱う形（1 ユーザーにつき 1 件） */
export type BudgetRecord = BudgetSetting & SyncRecord;

export const BUDGET_RECORD_ID = 'budget';

/** サーバーのテーブル名と、手元での記録の型 */
export type RemoteTables = {
  tasks: Task;
  ledger_entries: LedgerEntry;
  user_settings: BudgetRecord;
};

export type TableName = keyof RemoteTables;

export const TABLE_NAMES: readonly TableName[] = ['tasks', 'ledger_entries', 'user_settings'];

/** サーバーとのやり取り。Supabase 版とテスト用の偽物を差し替えられるようにする */
export interface RemoteStore {
  /**
   * since（サーバー側の記録時刻）より後に書き込まれた記録を取得する。
   * cursor は受け取った記録のうち最も新しいサーバー側の記録時刻（無ければ since のまま）。
   */
  pull<K extends TableName>(
    table: K,
    since: string | null,
  ): Promise<{ records: RemoteTables[K][]; cursor: string | null }>;
  /**
   * 記録を書き込む。サーバー側の記録の方が新しいものは書き込まれない。
   * accepted は実際に書き込まれた記録の id。
   */
  push<K extends TableName>(table: K, records: RemoteTables[K][]): Promise<{ accepted: string[] }>;
  /** 指定した id の記録を取得する */
  fetch<K extends TableName>(table: K, ids: string[]): Promise<RemoteTables[K][]>;
}

/** テーブルごとの同期の進み具合 */
export type TableSyncState = {
  /** 最後に受け取った記録のサーバー側の記録時刻 */
  cursor: string | null;
  /** id ごとの「サーバーと一致していると分かっている」updatedAt。異なれば未送信の変更がある */
  known: Record<string, string>;
};

export type SyncMeta = {
  /** 同期しているアカウント */
  userId: string;
  tables: Record<TableName, TableSyncState>;
  /** 最後に同期を完了した日時 */
  lastSyncedAt: string | null;
};

export function createSyncMeta(userId: string): SyncMeta {
  const empty = (): TableSyncState => ({ cursor: null, known: {} });
  return {
    userId,
    tables: { tasks: empty(), ledger_entries: empty(), user_settings: empty() },
    lastSyncedAt: null,
  };
}

/**
 * 予算を同期の対象として渡す形。一度も設定していない状態（初期値）は送らない
 * （アカウントにある予算を、未設定の端末が上書きしないようにするため）。
 */
export function budgetRecords(
  budget: { amount: number | null; updatedAt: string },
  initialUpdatedAt: string,
): BudgetRecord[] {
  if (budget.amount === null && budget.updatedAt === initialUpdatedAt) return [];
  return [{ id: BUDGET_RECORD_ID, amount: budget.amount, updatedAt: budget.updatedAt, deletedAt: null }];
}
