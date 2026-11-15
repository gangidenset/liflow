import type { SupabaseClient } from '@supabase/supabase-js';

import { isValidAmount, parseLedgerEntry } from '@/storage/ledgerStorage';
import { parseTask } from '@/storage/taskStorage';
import type { LedgerEntry } from '@/types/ledger';
import type { Task } from '@/types/task';

import {
  BUDGET_RECORD_ID,
  type BudgetRecord,
  type RemoteStore,
  type RemoteTables,
  type TableName,
} from './types';

/** 1 回のやり取りで扱う最大件数 */
const PAGE_SIZE = 500;

type Row = Record<string, unknown>;

/** サーバーの日時（マイクロ秒・+00:00 形式）を、端末と同じ ISO 形式（ミリ秒・Z）にそろえる */
function iso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

type Mapper<T> = {
  /** 1 行を手元の記録にする。復元できなければ null */
  fromRow: (row: Row) => T | null;
  toRow: (record: T, userId: string) => Row;
  /** 行を識別する列（user_settings はユーザーごとに 1 行） */
  idColumn: 'id' | 'user_id';
};

const taskMapper: Mapper<Task> = {
  idColumn: 'id',
  fromRow: (row) =>
    parseTask({
      id: row.id,
      title: row.title,
      note: row.note,
      dueDate: row.due_date,
      priority: row.priority,
      completed: row.completed,
      completedAt: iso(row.completed_at),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      deletedAt: iso(row.deleted_at),
    }),
  toRow: (task, userId) => ({
    user_id: userId,
    id: task.id,
    title: task.title,
    note: task.note,
    due_date: task.dueDate,
    priority: task.priority,
    completed: task.completed,
    completed_at: task.completedAt,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    deleted_at: task.deletedAt,
  }),
};

const entryMapper: Mapper<LedgerEntry> = {
  idColumn: 'id',
  fromRow: (row) =>
    parseLedgerEntry({
      id: row.id,
      type: row.type,
      date: row.date,
      amount: row.amount,
      category: row.category,
      note: row.note,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      deletedAt: iso(row.deleted_at),
    }),
  toRow: (entry, userId) => ({
    user_id: userId,
    id: entry.id,
    type: entry.type,
    date: entry.date,
    amount: entry.amount,
    category: entry.category,
    note: entry.note,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    deleted_at: entry.deletedAt,
  }),
};

const settingsMapper: Mapper<BudgetRecord> = {
  idColumn: 'user_id',
  fromRow: (row) => {
    const updatedAt = iso(row.updated_at);
    const amount = row.monthly_budget;
    if (!updatedAt || !(amount === null || isValidAmount(amount))) return null;
    return { id: BUDGET_RECORD_ID, amount, updatedAt, deletedAt: null };
  },
  toRow: (budget, userId) => ({
    user_id: userId,
    monthly_budget: budget.amount,
    updated_at: budget.updatedAt,
  }),
};

const MAPPERS: { [K in TableName]: Mapper<RemoteTables[K]> } = {
  tasks: taskMapper,
  ledger_entries: entryMapper,
  user_settings: settingsMapper,
};

/** user_settings は「行の id」がユーザー id なので、手元の id（budget）に読み替える */
function recordIdOf(table: TableName, row: Row): string {
  return table === 'user_settings' ? BUDGET_RECORD_ID : String(row.id);
}

function parseRows<K extends TableName>(table: K, rows: Row[]): RemoteTables[K][] {
  const mapper = MAPPERS[table];
  const records: RemoteTables[K][] = [];
  for (const row of rows) {
    const record = mapper.fromRow(row);
    if (record) records.push(record);
    else console.warn(`Skipped an invalid ${table} row`, recordIdOf(table, row));
  }
  return records;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Supabase とのやり取り。行レベルのアクセス制限で、ログイン中の本人の行だけが対象になる */
export function createSupabaseRemote(client: SupabaseClient, userId: string): RemoteStore {
  return {
    async pull(table, since) {
      const records: RemoteTables[typeof table][] = [];
      let cursor = since;
      // サーバー側の記録時刻の順に、続きがなくなるまで受け取る
      for (;;) {
        let query = client.from(table).select('*').eq('user_id', userId);
        if (cursor) query = query.gt('synced_at', cursor);
        const { data, error } = await query.order('synced_at', { ascending: true }).limit(PAGE_SIZE);
        if (error) throw error;
        const rows = (data ?? []) as Row[];
        records.push(...parseRows(table, rows));
        if (rows.length > 0) cursor = iso(rows[rows.length - 1].synced_at) ?? cursor;
        if (rows.length < PAGE_SIZE) break;
      }
      return { records, cursor };
    },

    async push(table, records) {
      const mapper = MAPPERS[table] as Mapper<RemoteTables[typeof table]>;
      const accepted: string[] = [];
      for (const part of chunk(records, PAGE_SIZE)) {
        // サーバー側の方が新しい行は、トリガーで書き込みが止められ、結果に含まれない
        const { data, error } = await client
          .from(table)
          .upsert(
            part.map((record) => mapper.toRow(record, userId)),
            { onConflict: table === 'user_settings' ? 'user_id' : 'user_id,id' },
          )
          .select(mapper.idColumn);
        if (error) throw error;
        for (const row of (data ?? []) as Row[]) accepted.push(recordIdOf(table, row));
      }
      return { accepted };
    },

    async fetch(table, ids) {
      const mapper = MAPPERS[table];
      const records: RemoteTables[typeof table][] = [];
      for (const part of chunk(ids, PAGE_SIZE)) {
        let query = client.from(table).select('*').eq('user_id', userId);
        if (mapper.idColumn === 'id') query = query.in('id', part);
        const { data, error } = await query;
        if (error) throw error;
        records.push(...parseRows(table, (data ?? []) as Row[]));
      }
      return records;
    },
  };
}
