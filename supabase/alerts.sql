-- BinderWish price alerts: "email me when this card drops to / rises to $X".
-- Checked nightly against the fresh TCGPlayer prices (scripts/check-alerts.mjs).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run. Safe to re-run.

create table if not exists public.price_alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game          text not null check (game in ('pokemon', 'lorcana', 'onepiece')),
  set_id        text not null check (char_length(set_id) <= 80),
  -- the binder slot (card + version) the alert is for, and its TCGPlayer product/printing
  slot_key      text not null check (char_length(slot_key) <= 300),
  product_id    bigint not null,
  printing      text check (char_length(printing) <= 60),
  -- shown on the alerts page and in the email
  card_name     text not null check (char_length(card_name) <= 160),
  set_name      text check (char_length(set_name) <= 160),
  variant_label text check (char_length(variant_label) <= 80),
  number_label  text check (char_length(number_label) <= 40),
  image         text check (char_length(image) <= 500),
  below         numeric(10, 2) check (below > 0),
  above         numeric(10, 2) check (above > 0),
  -- active: being watched · paused: by the collector · hit: reached, waiting to be re-armed
  status        text not null default 'active' check (status in ('active', 'paused', 'hit')),
  hit_at        timestamptz,
  hit_price     numeric(10, 2),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint price_alerts_target check (below is not null or above is not null),
  constraint price_alerts_one_per_card unique (user_id, slot_key)
);


create or replace function public.price_alerts_touch() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists price_alerts_touch on public.price_alerts;
create trigger price_alerts_touch before update on public.price_alerts for each row execute function public.price_alerts_touch();

-- Each collector sees and changes only their own alerts.
alter table public.price_alerts enable row level security;
drop policy if exists "Own alerts" on public.price_alerts;
create policy "Own alerts" on public.price_alerts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.price_alerts from anon, authenticated;
grant select, insert, update, delete on public.price_alerts to authenticated;

-- Per-account settings: email preference, the token behind the email's "Turn off
-- alert emails" link (which works without signing in), and how many alerts the
-- account may have — 2 on a free account. Collectors can change only `emails`;
-- the limit is raised here (or, later, by a paid plan), never from the app.
create table if not exists public.alert_settings (
  user_id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  emails            boolean not null default true,
  unsubscribe_token uuid not null default gen_random_uuid() unique
);
alter table public.alert_settings add column if not exists alert_limit integer not null default 2 check (alert_limit between 0 and 100);
alter table public.alert_settings enable row level security;
drop policy if exists "Own alert settings" on public.alert_settings;
create policy "Own alert settings" on public.alert_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.alert_settings from anon, authenticated;
grant select on public.alert_settings to authenticated;
grant insert (user_id, emails), update (emails) on public.alert_settings to authenticated;

-- Alerts per account: the account's alert_limit (2 unless raised).
create or replace function public.price_alerts_limit() returns trigger language plpgsql set search_path = '' as $$
declare
  cap integer := coalesce((select alert_limit from public.alert_settings where user_id = new.user_id), 2);
begin
  if (select count(*) from public.price_alerts where user_id = new.user_id) >= cap then
    raise exception 'alert limit reached' using errcode = 'P0001', hint = format('This account can have %s price alerts.', cap);
  end if;
  return new;
end;
$$;
drop trigger if exists price_alerts_limit on public.price_alerts;
create trigger price_alerts_limit before insert on public.price_alerts for each row execute function public.price_alerts_limit();

-- To give an account more alerts (e.g. a supporter), run:
--   update public.alert_settings set alert_limit = 10
--   where user_id = (select id from auth.users where email = 'them@example.com');
-- (If they've never opened My alerts, insert the row first:
--   insert into public.alert_settings (user_id, alert_limit)
--   select id, 10 from auth.users where email = 'them@example.com' on conflict (user_id) do update set alert_limit = 10;)

-- The unsubscribe link: turns alert emails off for whoever owns the token.
create or replace function public.alerts_unsubscribe(token uuid) returns boolean
language sql security definer set search_path = '' as $$
  update public.alert_settings set emails = false where unsubscribe_token = token returning true;
$$;
revoke execute on function public.alerts_unsubscribe(uuid) from public;
grant execute on function public.alerts_unsubscribe(uuid) to anon, authenticated;
