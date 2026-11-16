-- AI LIFE MANAGER Lite: クラウド同期用のテーブル
--
-- Supabase の管理画面 → SQL Editor にこのファイルの内容を貼り付けて実行してください。
-- 何度実行しても同じ結果になるように書いています。
--
-- 方針
-- - 各テーブルは「ログインした本人の行だけ」読み書きできる（行レベルのアクセス制限）
-- - 削除は行を消さずに deleted_at を入れる（他の端末に削除を伝えるため）
-- - 同じ行への書き込みは、updated_at が新しいときだけ反映する（古い変更で上書きしない）
-- - synced_at はサーバーが書き込んだ時刻。端末はこれを目印に差分を受け取る

-- ---------------------------------------------------------------------------
-- 共通: 古い変更を無視し、サーバー側の書き込み時刻を記録するトリガー
-- ---------------------------------------------------------------------------
create or replace function public.sync_keep_newer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at <= old.updated_at then
    -- 手元より古い（または同じ）変更は書き込まない
    return null;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- タスク
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  title text not null check (char_length(title) <= 200),
  note text not null default '' check (char_length(note) <= 2000),
  due_date date,
  priority text not null check (priority in ('high', 'medium', 'low')),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create index if not exists tasks_user_synced_idx on public.tasks (user_id, synced_at);

drop trigger if exists tasks_keep_newer on public.tasks;
create trigger tasks_keep_newer
before insert or update on public.tasks
for each row execute function public.sync_keep_newer();

-- ---------------------------------------------------------------------------
-- 家計簿の記録
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_entries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  type text not null check (type in ('expense', 'income')),
  date date not null,
  amount integer not null check (amount between 1 and 10000000),
  category text not null check (char_length(category) between 1 and 32),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create index if not exists ledger_entries_user_synced_idx
  on public.ledger_entries (user_id, synced_at);

drop trigger if exists ledger_entries_keep_newer on public.ledger_entries;
create trigger ledger_entries_keep_newer
before insert or update on public.ledger_entries
for each row execute function public.sync_keep_newer();

-- ---------------------------------------------------------------------------
-- ユーザー設定（1 か月の支出予算）
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  monthly_budget integer check (monthly_budget between 1 and 10000000),
  updated_at timestamptz not null,
  synced_at timestamptz not null default clock_timestamp()
);

create index if not exists user_settings_synced_idx on public.user_settings (synced_at);

drop trigger if exists user_settings_keep_newer on public.user_settings;
create trigger user_settings_keep_newer
before insert or update on public.user_settings
for each row execute function public.sync_keep_newer();

-- ---------------------------------------------------------------------------
-- 権限と行レベルのアクセス制限
--   未ログイン（anon）には一切の権限を与えない。
--   ログイン中（authenticated）も、自分の行の参照・追加・更新だけを許可する（行の削除はしない）。
-- ---------------------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.user_settings enable row level security;

revoke all on table public.tasks, public.ledger_entries, public.user_settings from anon, authenticated;
grant select, insert, update on table public.tasks, public.ledger_entries, public.user_settings
  to authenticated;

revoke all on function public.sync_keep_newer() from public, anon, authenticated;

drop policy if exists "own tasks: select" on public.tasks;
drop policy if exists "own tasks: insert" on public.tasks;
drop policy if exists "own tasks: update" on public.tasks;
create policy "own tasks: select" on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own tasks: insert" on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own tasks: update" on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own ledger entries: select" on public.ledger_entries;
drop policy if exists "own ledger entries: insert" on public.ledger_entries;
drop policy if exists "own ledger entries: update" on public.ledger_entries;
create policy "own ledger entries: select" on public.ledger_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own ledger entries: insert" on public.ledger_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own ledger entries: update" on public.ledger_entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own settings: select" on public.user_settings;
drop policy if exists "own settings: insert" on public.user_settings;
drop policy if exists "own settings: update" on public.user_settings;
create policy "own settings: select" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own settings: insert" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own settings: update" on public.user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- AI 機能の利用回数（1 日ごと）
--   Edge Function「ai」が Claude を呼ぶ前に ai_usage_increment() で数え、上限を超えたら止める。
--   日付の区切りは日本時間。
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;
grant select on table public.ai_usage to authenticated;

drop policy if exists "own ai usage: select" on public.ai_usage;
create policy "own ai usage: select" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- 呼び出した本人の今日の回数を 1 増やし、増やした後の回数を返す
create or replace function public.ai_usage_increment()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  result integer;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.ai_usage (user_id, day, count)
  values (caller, (now() at time zone 'Asia/Tokyo')::date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into result;
  return result;
end;
$$;

revoke all on function public.ai_usage_increment() from public, anon, authenticated;
grant execute on function public.ai_usage_increment() to authenticated;
