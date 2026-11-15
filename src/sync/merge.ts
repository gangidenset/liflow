/** 同期の対象になる記録が共通で持つ項目 */
export type SyncRecord = {
  id: string;
  /** 最後に変更した日時（ISO 8601、UTC） */
  updatedAt: string;
  /** 削除した日時。削除していなければ null。他の端末へ削除を伝えるため、記録自体は残す */
  deletedAt: string | null;
};

/** a が b より新しい変更か（同じ時刻なら新しくないとみなす） */
export function isNewer(a: { updatedAt: string }, b: { updatedAt: string }): boolean {
  return a.updatedAt > b.updatedAt;
}

/**
 * 手元の記録に、受け取った記録を取り込む。
 * 同じ id は updatedAt の新しい方を残し（同時刻なら手元を優先）、手元にない記録は先頭に加える。
 * 何も変わらなければ元の配列をそのまま返す。
 */
export function mergeById<T extends SyncRecord>(local: readonly T[], incoming: readonly T[]): T[] {
  if (incoming.length === 0) return local as T[];
  const incomingById = new Map(incoming.map((record) => [record.id, record]));
  let changed = false;

  const merged = local.map((record) => {
    const other = incomingById.get(record.id);
    if (!other) return record;
    incomingById.delete(record.id);
    if (isNewer(other, record)) {
      changed = true;
      return other;
    }
    return record;
  });

  const added = [...incomingById.values()];
  if (added.length > 0) changed = true;
  return changed ? [...added, ...merged] : (local as T[]);
}

/** 画面に出す記録（削除済みを除く） */
export function withoutDeleted<T extends SyncRecord>(records: readonly T[]): T[] {
  return records.filter((record) => record.deletedAt === null);
}
