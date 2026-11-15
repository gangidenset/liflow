import { mergeById, withoutDeleted } from '@/sync/merge';
import { countPending, runSync, type AnySyncCollection } from '@/sync/syncEngine';
import {
  BUDGET_RECORD_ID,
  budgetRecords,
  createSyncMeta,
  type BudgetRecord,
  type RemoteStore,
  type RemoteTables,
  type SyncMeta,
  type TableName,
} from '@/sync/types';
import type { LedgerEntry } from '@/types/ledger';
import type { Task } from '@/types/task';

import { makeEntry, makeTask } from './helpers';

/**
 * サーバーの偽物。supabase/schema.sql と同じ規則で動く:
 * - 同じ id は updatedAt が新しいときだけ書き換える
 * - 書き込むたびにサーバー側の記録時刻（syncedAt）を進める
 */
class FakeServer implements RemoteStore {
  private clock = Date.parse('2026-11-15T00:00:00.000Z');
  rows: { [K in TableName]: Map<string, { record: RemoteTables[K]; syncedAt: string }> } = {
    tasks: new Map(),
    ledger_entries: new Map(),
    user_settings: new Map(),
  };
  pushes = 0;
  failNext = false;

  private tick(): string {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  private check() {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('network error');
    }
  }

  async pull<K extends TableName>(table: K, since: string | null) {
    this.check();
    const rows = [...this.rows[table].values()]
      .filter((row) => since === null || row.syncedAt > since)
      .sort((a, b) => a.syncedAt.localeCompare(b.syncedAt));
    return {
      records: rows.map((row) => row.record) as RemoteTables[K][],
      cursor: rows.length > 0 ? rows[rows.length - 1].syncedAt : since,
    };
  }

  async push<K extends TableName>(table: K, records: RemoteTables[K][]) {
    this.check();
    this.pushes += 1;
    const map = this.rows[table] as Map<string, { record: RemoteTables[K]; syncedAt: string }>;
    const accepted: string[] = [];
    for (const record of records) {
      const current = map.get(record.id);
      if (current && record.updatedAt <= current.record.updatedAt) continue;
      map.set(record.id, { record, syncedAt: this.tick() });
      accepted.push(record.id);
    }
    return { accepted };
  }

  async fetch<K extends TableName>(table: K, ids: string[]) {
    this.check();
    const map = this.rows[table] as Map<string, { record: RemoteTables[K]; syncedAt: string }>;
    return ids.flatMap((id) => {
      const row = map.get(id);
      return row ? [row.record] : [];
    });
  }
}

const INITIAL = '1970-01-01T00:00:00.000Z';

/** 1 台の端末（手元の記録と同期の進み具合） */
class Device {
  tasks: Task[] = [];
  entries: LedgerEntry[] = [];
  budget: BudgetRecord = {
    id: BUDGET_RECORD_ID,
    amount: null,
    updatedAt: INITIAL,
    deletedAt: null,
  };
  meta: SyncMeta = createSyncMeta('user-1');

  constructor(private server: FakeServer) {}

  collections(): AnySyncCollection[] {
    return [
      {
        table: 'tasks',
        getLocal: () => this.tasks,
        apply: (records) => {
          this.tasks = mergeById(this.tasks, records);
        },
      },
      {
        table: 'ledger_entries',
        getLocal: () => this.entries,
        apply: (records) => {
          this.entries = mergeById(this.entries, records);
        },
      },
      {
        table: 'user_settings',
        getLocal: () => budgetRecords(this.budget, INITIAL),
        apply: (records) => {
          [this.budget] = mergeById([this.budget], records);
        },
      },
    ];
  }

  async sync() {
    this.meta = await runSync(this.server, this.collections(), this.meta);
  }

  pending() {
    return countPending(this.collections(), this.meta);
  }

  visibleTitles() {
    return withoutDeleted(this.tasks)
      .map((t) => t.title)
      .sort();
  }
}

const T = (n: number) => `2026-11-15T09:00:${String(n).padStart(2, '0')}.000Z`;

let server: FakeServer;
let a: Device;
let b: Device;

beforeEach(() => {
  server = new FakeServer();
  a = new Device(server);
  b = new Device(server);
});

describe('runSync', () => {
  it('初回は手元の記録をすべてアカウントに送り、別の端末で受け取れる', async () => {
    a.tasks = [makeTask({ id: 't1', title: '牛乳' }), makeTask({ id: 't2', title: '掃除' })];
    a.entries = [makeEntry({ id: 'e1', amount: 500 })];
    a.budget = { ...a.budget, amount: 30000, updatedAt: T(1) };
    expect(a.pending()).toBe(4);

    await a.sync();
    expect(a.pending()).toBe(0);
    expect(a.meta.lastSyncedAt).not.toBeNull();

    await b.sync();
    expect(b.visibleTitles()).toEqual(['掃除', '牛乳']);
    expect(b.entries.map((e) => e.amount)).toEqual([500]);
    expect(b.budget.amount).toBe(30000);
    expect(b.pending()).toBe(0);
  });

  it('変更がなければ何も送らない', async () => {
    a.tasks = [makeTask({ id: 't1' })];
    await a.sync();
    const pushes = server.pushes;
    await a.sync();
    await a.sync();
    expect(server.pushes).toBe(pushes);
  });

  it('編集と削除が他の端末に伝わる', async () => {
    a.tasks = [makeTask({ id: 't1', title: '牛乳' }), makeTask({ id: 't2', title: '掃除' })];
    await a.sync();
    await b.sync();

    a.tasks = a.tasks.map((t) =>
      t.id === 't1' ? { ...t, title: '牛乳と卵', updatedAt: T(1) } : { ...t, deletedAt: T(1), updatedAt: T(1) },
    );
    expect(a.pending()).toBe(2);
    await a.sync();
    await b.sync();
    expect(b.visibleTitles()).toEqual(['牛乳と卵']);
  });

  it('両方の端末で同じ記録を変えたら、後から変更した方が両方に残る', async () => {
    a.tasks = [makeTask({ id: 't1', title: '元' })];
    await a.sync();
    await b.sync();

    // オフラインで両方が編集（B の方が後）
    a.tasks = [{ ...a.tasks[0], title: 'A の編集', updatedAt: T(1) }];
    b.tasks = [{ ...b.tasks[0], title: 'B の編集', updatedAt: T(2) }];

    await a.sync();
    await b.sync();
    await a.sync();
    expect(a.visibleTitles()).toEqual(['B の編集']);
    expect(b.visibleTitles()).toEqual(['B の編集']);
    expect(a.pending()).toBe(0);
    expect(b.pending()).toBe(0);
  });

  it('古い変更を後から送った端末も、サーバーの新しい内容にそろう', async () => {
    a.tasks = [makeTask({ id: 't1', title: '元' })];
    await a.sync();
    await b.sync();

    b.tasks = [{ ...b.tasks[0], title: 'B の新しい編集', updatedAt: T(5) }];
    await b.sync();

    // A は B の変更を受け取る前に、より古い時刻の編集をしていた（受け取り済みの範囲より前）
    a.meta = { ...a.meta, tables: { ...a.meta.tables, tasks: { ...a.meta.tables.tasks } } };
    a.tasks = [{ ...a.tasks[0], title: 'A の古い編集', updatedAt: T(3) }];
    await a.sync();
    expect(a.visibleTitles()).toEqual(['B の新しい編集']);
    expect(a.pending()).toBe(0);
  });

  it('サーバーで書き込みを断られた記録は、最新の内容を取り寄せてそろえる', async () => {
    a.tasks = [makeTask({ id: 't1', title: '元' })];
    await a.sync();
    // A が受け取り済みの範囲に、より新しい記録がすでにある状態を作る
    server.rows.tasks.set('t1', {
      record: makeTask({ id: 't1', title: 'サーバーの新しい内容', updatedAt: T(9) }),
      syncedAt: '2000-01-01T00:00:00.000Z',
    });
    a.tasks = [{ ...a.tasks[0], title: 'A の編集', updatedAt: T(4) }];
    await a.sync();
    expect(a.visibleTitles()).toEqual(['サーバーの新しい内容']);
    expect(a.pending()).toBe(0);
  });

  it('予算の変更と解除が伝わる', async () => {
    a.budget = { ...a.budget, amount: 50000, updatedAt: T(1) };
    await a.sync();
    await b.sync();
    expect(b.budget.amount).toBe(50000);

    b.budget = { ...b.budget, amount: null, updatedAt: T(2) };
    await b.sync();
    await a.sync();
    expect(a.budget.amount).toBeNull();
  });

  it('予算を設定していない端末が、アカウントの予算を上書きしない', async () => {
    a.budget = { ...a.budget, amount: 50000, updatedAt: T(1) };
    await a.sync();
    await b.sync();
    expect(b.budget.amount).toBe(50000);
    await a.sync();
    expect(a.budget.amount).toBe(50000);
  });

  it('通信に失敗したら例外になり、未送信の変更は残って次回送られる', async () => {
    a.tasks = [makeTask({ id: 't1', title: '牛乳' })];
    server.failNext = true;
    await expect(a.sync()).rejects.toThrow('network error');
    expect(a.pending()).toBe(1);
    await a.sync();
    expect(a.pending()).toBe(0);
    await b.sync();
    expect(b.visibleTitles()).toEqual(['牛乳']);
  });

  it('同期中に手元で加えた変更は、次回の同期で送られる', async () => {
    a.tasks = [makeTask({ id: 't1', title: '牛乳' })];
    await a.sync();
    a.tasks = [makeTask({ id: 't2', title: '同期の後に追加' }), ...a.tasks];
    expect(a.pending()).toBe(1);
    await a.sync();
    await b.sync();
    expect(b.visibleTitles()).toEqual(['同期の後に追加', '牛乳']);
  });
});
