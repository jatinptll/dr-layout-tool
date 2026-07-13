-- Duke Realty Supabase setup
-- Run this in the Supabase SQL Editor before deploying the app.

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  role text not null check (role in ('admin', 'sales', 'site', 'super_admin')),
  name text not null,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles
add column if not exists username text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_username_lowercase'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
    add constraint user_profiles_username_lowercase
    check (username is null or username = lower(username));
  end if;
end $$;

create unique index if not exists user_profiles_username_key
  on public.user_profiles (username)
  where username is not null;

alter table public.user_profiles
drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
add constraint user_profiles_role_check
check (role in ('admin', 'sales', 'site', 'super_admin'));

create table if not exists public.houses (
  project text not null check (project in ('antonia', 'aranya')),
  house_number integer not null,
  plot_size text not null default '',
  facing text not null default '',
  type text not null default '',
  status text not null default 'available' check (status in ('available', 'booked', 'hold')),
  price text not null default '',
  customer_name text not null default '',
  customer_phone text not null default '',
  booking_date text not null default '',
  payment_status text not null default '',
  construction_stage text not null default '',
  pending_work text not null default '',
  extra_work text not null default '',
  material_status text not null default '',
  contractor_name text not null default '',
  site_notes text not null default '',
  remarks text not null default '',
  target_date text not null default '',
  flooring text not null default '',
  cost_price text not null default '',
  profit_margin text not null default '',
  internal_notes text not null default '',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (project, house_number),
  constraint valid_house_number check (
    (project = 'antonia' and house_number between 1 and 34)
    or
    (project = 'aranya' and house_number between 1 and 68)
  )
);

alter table public.houses
drop constraint if exists houses_status_check;

alter table public.houses
add constraint houses_status_check
check (status in ('available', 'booked', 'hold'));

alter table public.houses
add column if not exists extra_work text not null default '',
add column if not exists remarks text not null default '',
add column if not exists flooring text not null default '';

create index if not exists houses_project_status_idx on public.houses (project, status);

create table if not exists public.house_change_events (
  id bigint generated always as identity primary key,
  project text not null,
  house_number integer not null,
  status text not null,
  changed_at timestamptz not null default now()
);

create index if not exists house_change_events_changed_at_idx
  on public.house_change_events (changed_at desc);

create table if not exists public.user_presence (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  route text not null default '#/dashboard',
  visibility text not null default 'visible',
  last_seen_at timestamptz not null default now(),
  primary key (user_id, session_id),
  constraint user_presence_session_id_not_empty check (length(trim(session_id)) > 0)
);

create index if not exists user_presence_last_seen_at_idx
  on public.user_presence (last_seen_at desc);

alter table public.user_profiles enable row level security;
alter table public.houses enable row level security;
alter table public.house_change_events enable row level security;
alter table public.user_presence enable row level security;

revoke all on public.houses from anon, authenticated;
revoke all on public.user_profiles from anon, authenticated;
revoke all on public.house_change_events from anon, authenticated;
revoke all on public.user_presence from anon, authenticated;

grant select on public.user_profiles to authenticated;
grant select on public.house_change_events to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_touch_updated_at on public.user_profiles;
create trigger user_profiles_touch_updated_at
before update on public.user_profiles
for each row execute function public.touch_updated_at();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_profiles where id = (select auth.uid());
$$;

create or replace function public.resolve_login_email(login_identifier text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select au.email
  from public.user_profiles up
  join auth.users au on au.id = up.id
  where up.username = lower(trim(login_identifier))
  limit 1;
$$;

create policy "Users can read own profile"
on public.user_profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "Admins can manage profiles"
on public.user_profiles
for all
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy "Authenticated users can read non-sensitive change events"
on public.house_change_events
for select
to authenticated
using (true);

create policy "Users can read own presence"
on public.user_presence
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can manage own presence"
on public.user_presence
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop function if exists public.update_house(text, integer, jsonb);
drop function if exists public.get_houses_for_current_user();

create or replace function public.get_houses_for_current_user()
returns table (
  project text,
  house_number integer,
  plot_size text,
  facing text,
  type text,
  status text,
  price text,
  customer_name text,
  customer_phone text,
  booking_date text,
  payment_status text,
  construction_stage text,
  pending_work text,
  extra_work text,
  material_status text,
  contractor_name text,
  site_notes text,
  remarks text,
  target_date text,
  flooring text,
  cost_price text,
  profit_margin text,
  internal_notes text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  user_role text := public.current_user_role();
begin
  if user_role is null then
    raise exception 'No Duke Realty profile exists for this user';
  end if;

  return query
  select
    h.project,
    h.house_number,
    h.plot_size,
    h.facing,
    h.type,
    h.status,
    case when user_role in ('admin', 'super_admin', 'sales') then h.price else '' end,
    case when user_role in ('admin', 'super_admin', 'sales') then h.customer_name else '' end,
    case when user_role in ('admin', 'super_admin', 'sales') then h.customer_phone else '' end,
    case when user_role in ('admin', 'super_admin', 'sales') then h.booking_date else '' end,
    case when user_role in ('admin', 'super_admin', 'sales') then h.payment_status else '' end,
    case when user_role in ('admin', 'super_admin', 'site') then h.construction_stage else '' end,
    case when user_role in ('admin', 'super_admin', 'site') then h.pending_work else '' end,
    case when user_role in ('admin', 'super_admin', 'site') then h.extra_work else '' end,
    case when user_role in ('admin', 'super_admin', 'site') then h.material_status else '' end,
    case when user_role in ('admin', 'super_admin', 'site') then h.contractor_name else '' end,
    case when user_role in ('admin', 'super_admin', 'site') then h.site_notes else '' end,
    case when user_role in ('admin', 'super_admin', 'site') then h.remarks else '' end,
    case when user_role in ('admin', 'super_admin', 'site') then h.target_date else '' end,
    case when user_role in ('admin', 'super_admin', 'site') then h.flooring else '' end,
    case when user_role in ('admin', 'super_admin') then h.cost_price else '' end,
    case when user_role in ('admin', 'super_admin') then h.profit_margin else '' end,
    case when user_role in ('admin', 'super_admin') then h.internal_notes else '' end
  from public.houses h
  order by h.project, h.house_number;
end;
$$;

create or replace function public.update_house(
  h_project text,
  h_house_number integer,
  h_updates jsonb
)
returns table (
  project text,
  house_number integer,
  plot_size text,
  facing text,
  type text,
  status text,
  price text,
  customer_name text,
  customer_phone text,
  booking_date text,
  payment_status text,
  construction_stage text,
  pending_work text,
  extra_work text,
  material_status text,
  contractor_name text,
  site_notes text,
  remarks text,
  target_date text,
  flooring text,
  cost_price text,
  profit_margin text,
  internal_notes text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('admin', 'super_admin') then
    raise exception 'Only administrators can update house data';
  end if;

  update public.houses h
  set
    plot_size = case when h_updates ? 'plot_size' then coalesce(h_updates->>'plot_size', '') else h.plot_size end,
    facing = case when h_updates ? 'facing' then coalesce(h_updates->>'facing', '') else h.facing end,
    type = case when h_updates ? 'type' then coalesce(h_updates->>'type', '') else h.type end,
    status = case when h_updates ? 'status' then coalesce(h_updates->>'status', 'available') else h.status end,
    price = case when h_updates ? 'price' then coalesce(h_updates->>'price', '') else h.price end,
    customer_name = case when h_updates ? 'customer_name' then coalesce(h_updates->>'customer_name', '') else h.customer_name end,
    customer_phone = case when h_updates ? 'customer_phone' then coalesce(h_updates->>'customer_phone', '') else h.customer_phone end,
    booking_date = case when h_updates ? 'booking_date' then coalesce(h_updates->>'booking_date', '') else h.booking_date end,
    payment_status = case when h_updates ? 'payment_status' then coalesce(h_updates->>'payment_status', '') else h.payment_status end,
    construction_stage = case when h_updates ? 'construction_stage' then coalesce(h_updates->>'construction_stage', '') else h.construction_stage end,
    pending_work = case when h_updates ? 'pending_work' then coalesce(h_updates->>'pending_work', '') else h.pending_work end,
    extra_work = case when h_updates ? 'extra_work' then coalesce(h_updates->>'extra_work', '') else h.extra_work end,
    material_status = case when h_updates ? 'material_status' then coalesce(h_updates->>'material_status', '') else h.material_status end,
    contractor_name = case when h_updates ? 'contractor_name' then coalesce(h_updates->>'contractor_name', '') else h.contractor_name end,
    site_notes = case when h_updates ? 'site_notes' then coalesce(h_updates->>'site_notes', '') else h.site_notes end,
    remarks = case when h_updates ? 'remarks' then coalesce(h_updates->>'remarks', '') else h.remarks end,
    target_date = case when h_updates ? 'target_date' then coalesce(h_updates->>'target_date', '') else h.target_date end,
    flooring = case when h_updates ? 'flooring' then coalesce(h_updates->>'flooring', '') else h.flooring end,
    cost_price = case when h_updates ? 'cost_price' then coalesce(h_updates->>'cost_price', '') else h.cost_price end,
    profit_margin = case when h_updates ? 'profit_margin' then coalesce(h_updates->>'profit_margin', '') else h.profit_margin end,
    internal_notes = case when h_updates ? 'internal_notes' then coalesce(h_updates->>'internal_notes', '') else h.internal_notes end,
    updated_by = (select auth.uid()),
    updated_at = now()
  where h.project = h_project
    and h.house_number = h_house_number;

  if not found then
    raise exception 'House %.% does not exist', h_project, h_house_number;
  end if;

  return query
  select *
  from public.get_houses_for_current_user() gh
  where gh.project = h_project
    and gh.house_number = h_house_number;
end;
$$;

revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.get_houses_for_current_user() from public, anon;
revoke execute on function public.update_house(text, integer, jsonb) from public, anon;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.get_houses_for_current_user() to authenticated;
grant execute on function public.update_house(text, integer, jsonb) to authenticated;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

create or replace function public.track_user_presence(
  p_session_id text,
  p_route text default '#/dashboard',
  p_visibility text default 'visible'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  insert into public.user_presence (
    user_id,
    session_id,
    route,
    visibility,
    last_seen_at
  )
  values (
    (select auth.uid()),
    left(trim(coalesce(p_session_id, '')), 120),
    left(coalesce(nullif(trim(p_route), ''), '#/dashboard'), 120),
    left(coalesce(nullif(trim(p_visibility), ''), 'visible'), 32),
    now()
  )
  on conflict (user_id, session_id)
  do update set
    route = excluded.route,
    visibility = excluded.visibility,
    last_seen_at = excluded.last_seen_at;
end;
$$;

create or replace function public.clear_user_presence(p_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    return;
  end if;

  delete from public.user_presence
  where user_id = (select auth.uid())
    and session_id = left(trim(coalesce(p_session_id, '')), 120);
end;
$$;

create or replace function public.get_online_users(active_seconds integer default 90)
returns table (
  user_id uuid,
  email text,
  username text,
  role text,
  name text,
  label text,
  route text,
  visibility text,
  last_seen_at timestamptz,
  tab_count integer
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if public.current_user_role() <> 'super_admin' then
    raise exception 'Only super administrators can view online users';
  end if;

  return query
  with active_presence as (
    select
      presence.user_id as presence_user_id,
      presence.session_id as presence_session_id,
      presence.route as presence_route,
      presence.visibility as presence_visibility,
      presence.last_seen_at as presence_last_seen_at
    from public.user_presence as presence
    where presence.last_seen_at >= now() - make_interval(secs => greatest(coalesce(active_seconds, 90), 30))
  ),
  latest_presence as (
    select distinct on (ap.presence_user_id)
      ap.presence_user_id,
      ap.presence_route,
      ap.presence_visibility,
      ap.presence_last_seen_at
    from active_presence as ap
    order by ap.presence_user_id, ap.presence_last_seen_at desc
  ),
  session_counts as (
    select
      ap.presence_user_id,
      count(*)::integer as presence_tab_count
    from active_presence as ap
    group by ap.presence_user_id
  )
  select
    up.id as user_id,
    au.email::text as email,
    up.username as username,
    up.role as role,
    up.name as name,
    up.label as label,
    lp.presence_route as route,
    lp.presence_visibility as visibility,
    lp.presence_last_seen_at as last_seen_at,
    sc.presence_tab_count as tab_count
  from latest_presence as lp
  join session_counts as sc on sc.presence_user_id = lp.presence_user_id
  join public.user_profiles as up on up.id = lp.presence_user_id
  join auth.users as au on au.id = lp.presence_user_id
  order by lp.presence_last_seen_at desc;
end;
$$;

grant execute on function public.track_user_presence(text, text, text) to authenticated;
grant execute on function public.clear_user_presence(text) to authenticated;
grant execute on function public.get_online_users(integer) to authenticated;

create or replace function public.log_house_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.house_change_events (project, house_number, status)
  values (new.project, new.house_number, new.status);
  return new;
end;
$$;

drop trigger if exists houses_log_change on public.houses;
create trigger houses_log_change
after insert or update on public.houses
for each row execute function public.log_house_change();

insert into public.houses (project, house_number)
select 'antonia', generate_series(1, 34)
on conflict (project, house_number) do nothing;

insert into public.houses (project, house_number)
select 'aranya', generate_series(1, 68)
on conflict (project, house_number) do nothing;

-- Enable realtime for non-sensitive change events.
do $$
begin
  alter publication supabase_realtime add table public.house_change_events;
exception
  when duplicate_object then null;
end $$;

-- After creating Auth users in Supabase, add profiles like this:
-- insert into public.user_profiles (id, username, role, name, label)
-- values (
--   (select id from auth.users where email = 'owner@example.com'),
--   'admin',
--   'admin',
--   'Admin',
--   'Administrator'
-- );
