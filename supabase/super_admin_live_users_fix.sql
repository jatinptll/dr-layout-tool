-- Super admin + live users fix
-- Run this in the Supabase SQL Editor for the production project.

alter table public.user_profiles
drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
add constraint user_profiles_role_check
check (role in ('admin', 'sales', 'site', 'super_admin'));

drop policy if exists "Admins can manage profiles" on public.user_profiles;
create policy "Admins can manage profiles"
on public.user_profiles
for all
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

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

alter table public.user_presence enable row level security;
revoke all on public.user_presence from anon, authenticated;

drop policy if exists "Users can read own presence" on public.user_presence;
create policy "Users can read own presence"
on public.user_presence
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can manage own presence" on public.user_presence;
create policy "Users can manage own presence"
on public.user_presence
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

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
  material_status text,
  contractor_name text,
  site_notes text,
  target_date text,
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
    case when user_role in ('admin', 'super_admin', 'site') then h.material_status else '' end,
    case when user_role in ('admin', 'super_admin', 'site') then h.contractor_name else '' end,
    case when user_role in ('admin', 'super_admin', 'site') then h.site_notes else '' end,
    case when user_role in ('admin', 'super_admin', 'site') then h.target_date else '' end,
    case when user_role in ('admin', 'super_admin') then h.cost_price else '' end,
    case when user_role in ('admin', 'super_admin') then h.profit_margin else '' end,
    case when user_role in ('admin', 'super_admin') then h.internal_notes else '' end
  from public.houses h
  order by h.project, h.house_number;
end;
$$;

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

grant execute on function public.get_houses_for_current_user() to authenticated;
grant execute on function public.track_user_presence(text, text, text) to authenticated;
grant execute on function public.clear_user_presence(text) to authenticated;
grant execute on function public.get_online_users(integer) to authenticated;

notify pgrst, 'reload schema';
