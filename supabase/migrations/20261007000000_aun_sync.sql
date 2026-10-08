-- AUN · Phase 9 — user data sync.
-- One generic table for every synced collection (calendars, events, tasks…).
-- The app is offline-first: rows are created on the device with client UUIDs
-- and pushed here; `updated_at` (client) decides conflicts (last write wins)
-- and `server_updated_at` (server clock) is the pull cursor.

create table if not exists public.records (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection        text        not null check (collection ~ '^[A-Za-z][A-Za-z0-9]{0,39}$'),
  id                text        not null check (char_length(id) between 1 and 64),
  data              jsonb       not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, collection, id)
);

create index if not exists records_pull_idx on public.records (user_id, server_updated_at);

-- Row Level Security: a user only ever sees and writes their own rows.
alter table public.records enable row level security;

drop policy if exists "records: owner can read" on public.records;
create policy "records: owner can read" on public.records
  for select using (auth.uid() = user_id);

drop policy if exists "records: owner can insert" on public.records;
create policy "records: owner can insert" on public.records
  for insert with check (auth.uid() = user_id);

drop policy if exists "records: owner can update" on public.records;
create policy "records: owner can update" on public.records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- No delete policy: deletions are tombstones (deleted_at) so they sync.

-- Server cursor always moves forward on change.
create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();

-- Batch upsert used by the app. SECURITY INVOKER: runs with the caller's
-- rights, so RLS still applies; user_id is always the caller.
create or replace function public.sync_push(records jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare
  applied integer;
begin
  if jsonb_typeof(records) <> 'array' or jsonb_array_length(records) > 500 then
    raise exception 'records must be an array of at most 500 rows';
  end if;

  insert into public.records as r (user_id, collection, id, data, updated_at, deleted_at)
  select auth.uid(), x.collection, x.id, x.data, x.updated_at, x.deleted_at
  from jsonb_to_recordset(records) as x(collection text, id text, data jsonb, updated_at timestamptz, deleted_at timestamptz)
  on conflict (user_id, collection, id) do update
    set data = excluded.data,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    -- last write wins: an older copy never overwrites a newer one
    where excluded.updated_at >= r.updated_at;

  get diagnostics applied = row_count;
  return applied;
end $$;

revoke all on function public.sync_push(jsonb) from public, anon;
grant execute on function public.sync_push(jsonb) to authenticated;
revoke all on public.records from anon;
grant select, insert, update on public.records to authenticated;
