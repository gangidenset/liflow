import AsyncStorage from '@react-native-async-storage/async-storage';

import { TABLE_NAMES, type SyncMeta } from '@/sync/types';

const STORAGE_KEY = '@ai-life-manager/sync/v1';

function isTableState(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.cursor === null || typeof v.cursor === 'string') &&
    typeof v.known === 'object' &&
    v.known !== null
  );
}

/** 同期の進み具合。無い・壊れている場合は null（最初から同期し直す） */
export async function loadSyncMeta(): Promise<SyncMeta | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const v = JSON.parse(raw) as Record<string, unknown>;
    const tables = v.tables as Record<string, unknown> | undefined;
    if (typeof v.userId !== 'string' || !tables) return null;
    if (!TABLE_NAMES.every((name) => isTableState(tables[name]))) return null;
    return v as unknown as SyncMeta;
  } catch {
    return null;
  }
}

export async function saveSyncMeta(meta: SyncMeta): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

export async function clearSyncMeta(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
