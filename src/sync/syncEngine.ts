import { mergeById, type SyncRecord } from './merge';
import type { RemoteStore, RemoteTables, SyncMeta, TableName, TableSyncState } from './types';

/** 取りこぼし防止のため、前回の続きより少し前から受け取り直す（秒） */
const PULL_OVERLAP_SECONDS = 5;

/** 同期の対象（手元の記録の読み出しと、受け取った記録の取り込み） */
export type SyncCollection<K extends TableName> = {
  table: K;
  /** 削除済みも含む手元の全記録（呼んだ時点の最新） */
  getLocal: () => RemoteTables[K][];
  /** 受け取った記録を手元に取り込む（新しい方を残す） */
  apply: (records: RemoteTables[K][]) => void;
};

export type AnySyncCollection = { [K in TableName]: SyncCollection<K> }[TableName];

function rewind(cursor: string | null): string | null {
  if (cursor === null) return null;
  return new Date(new Date(cursor).getTime() - PULL_OVERLAP_SECONDS * 1000).toISOString();
}

/** サーバーにまだ送っていない記録 */
export function pendingRecords<T extends SyncRecord>(records: readonly T[], state: TableSyncState): T[] {
  return records.filter((record) => state.known[record.id] !== record.updatedAt);
}

async function syncCollection<K extends TableName>(
  remote: RemoteStore,
  collection: SyncCollection<K>,
  state: TableSyncState,
): Promise<TableSyncState> {
  const known = { ...state.known };

  // 1. サーバーの変更を受け取って取り込む
  const pulled = await remote.pull(collection.table, rewind(state.cursor));
  if (pulled.records.length > 0) collection.apply(pulled.records);
  for (const record of pulled.records) known[record.id] = record.updatedAt;

  // 2. 取り込んだ結果のうち、サーバーと一致していない記録を送る
  //    （取り込みは非同期に反映されるため、ここでも同じ規則で合わせた結果を使う）
  const merged = mergeById(collection.getLocal(), pulled.records);
  const pending = pendingRecords(merged, { cursor: null, known });
  if (pending.length > 0) {
    const { accepted } = await remote.push(collection.table, pending);
    const acceptedIds = new Set(accepted);
    for (const record of pending) {
      if (acceptedIds.has(record.id)) known[record.id] = record.updatedAt;
    }
    // 3. サーバー側の方が新しく書き込まれなかった記録は、サーバーの内容を取り込む
    const rejected = pending.filter((record) => !acceptedIds.has(record.id)).map((r) => r.id);
    if (rejected.length > 0) {
      const latest = await remote.fetch(collection.table, rejected);
      if (latest.length > 0) collection.apply(latest);
      for (const record of latest) known[record.id] = record.updatedAt;
    }
  }

  return { cursor: pulled.cursor ?? state.cursor, known };
}

/**
 * すべての対象を同期する。途中で失敗した場合は例外を投げ、それまでに完了した分の進み具合は失われる
 * （次回やり直しても、同じ記録を受け取り直すだけで結果は変わらない）。
 */
export async function runSync(
  remote: RemoteStore,
  collections: readonly AnySyncCollection[],
  meta: SyncMeta,
  now: () => string = () => new Date().toISOString(),
): Promise<SyncMeta> {
  const tables = { ...meta.tables };
  for (const collection of collections) {
    // 型は TableName ごとに対応しているが、まとめて扱うために広げる
    tables[collection.table] = await syncCollection(
      remote,
      collection as SyncCollection<TableName>,
      tables[collection.table],
    );
  }
  return { ...meta, tables, lastSyncedAt: now() };
}

/** 未送信の変更の件数 */
export function countPending(collections: readonly AnySyncCollection[], meta: SyncMeta): number {
  return collections.reduce(
    (sum, collection) =>
      sum +
      pendingRecords(
        (collection as SyncCollection<TableName>).getLocal(),
        meta.tables[collection.table],
      ).length,
    0,
  );
}
