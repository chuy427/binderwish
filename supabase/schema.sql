-- BinderWish accounts: one row per user holding their collection (owned
-- checklist, print sheet and print settings). Run once in the Supabase
-- dashboard: SQL Editor → New query → paste → Run. Safe to re-run.

create table if not exists public.collections (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  owned      jsonb not null default '[]'::jsonb,
  queue      jsonb not null default '[]'::jsonb,
  options    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  -- Keep rows to a sane size (a full master-set print sheet plus a logo is well under this).
  constraint collections_size check (pg_column_size(owned) + pg_column_size(queue) + pg_column_size(options) < 3000000)
);

-- Row-level security: each signed-in person can only see and change their own row.
alter table public.collections enable row level security;

drop policy if exists "Read own collection" on public.collections;
drop policy if exists "Create own collection" on public.collections;
drop policy if exists "Update own collection" on public.collections;
drop policy if exists "Delete own collection" on public.collections;

create policy "Read own collection" on public.collections
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own collection" on public.collections
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own collection" on public.collections
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own collection" on public.collections
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.collections from anon;
grant select, insert, update, delete on public.collections to authenticated;

-- "Delete my account": removes the sign-in and (via the cascade) the collection.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
