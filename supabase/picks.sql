-- BinderWish picks: curated sets anyone can browse and collect, published from the
-- app by approved curators (BinderWish itself, and later creators and vendors).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run. Safe to re-run.

-- Curators: who may publish. Added here (by the site owner), never from the app.
create table if not exists public.curators (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  kind       text not null default 'creator' check (kind in ('binderwish', 'creator', 'vendor')),
  created_at timestamptz not null default now()
);

alter table public.curators enable row level security;
drop policy if exists "Anyone can see curators" on public.curators;
create policy "Anyone can see curators" on public.curators for select to anon, authenticated using (true);
-- No insert/update/delete policies: only the dashboard (service role) manages curators.
revoke all on public.curators from anon, authenticated;
grant select on public.curators to anon, authenticated;

-- Picks: a custom-set definition plus title, description and cover cards.
create table if not exists public.picks (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  curator_id  uuid not null references public.curators (user_id) on delete cascade,
  game        text not null check (game in ('pokemon', 'lorcana', 'onepiece')),
  title       text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 600),
  -- { names: [], artists: [], picks: [{ setId, key }], hidden: [] } — same as a custom set
  definition  jsonb not null,
  -- [{ key, img }] — up to 3 cards shown on the pick's cover
  covers      jsonb not null default '[]'::jsonb,
  card_count  integer not null default 0,
  -- the curator's own custom set it was published from (so it can be updated)
  source_id   text,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint picks_size check (pg_column_size(definition) + pg_column_size(covers) < 300000)
);

create or replace function public.picks_touch() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists picks_touch on public.picks;
create trigger picks_touch before update on public.picks for each row execute function public.picks_touch();

alter table public.picks enable row level security;
drop policy if exists "Anyone can see published picks" on public.picks;
drop policy if exists "Curators publish picks" on public.picks;
drop policy if exists "Curators edit their picks" on public.picks;
drop policy if exists "Curators delete their picks" on public.picks;

create policy "Anyone can see published picks" on public.picks
  for select to anon, authenticated using (published or curator_id = (select auth.uid()));
create policy "Curators publish picks" on public.picks
  for insert to authenticated with check (
    curator_id = (select auth.uid()) and exists (select 1 from public.curators c where c.user_id = (select auth.uid())));
create policy "Curators edit their picks" on public.picks
  for update to authenticated using (curator_id = (select auth.uid())) with check (curator_id = (select auth.uid()));
create policy "Curators delete their picks" on public.picks
  for delete to authenticated using (curator_id = (select auth.uid()));

revoke all on public.picks from anon, authenticated;
grant select on public.picks to anon, authenticated;
grant insert, update, delete on public.picks to authenticated;

-- Make yourself the first curator ("BinderWish"). Use the email you sign in to
-- binderwish.com with; to add a creator or vendor later, run the same line with
-- their email, their shop/creator name, and 'creator' or 'vendor'.
insert into public.curators (user_id, name, kind)
select id, 'BinderWish', 'binderwish' from auth.users where email = 'chuy427jg@gmail.com'
on conflict (user_id) do update set name = excluded.name, kind = excluded.kind;
