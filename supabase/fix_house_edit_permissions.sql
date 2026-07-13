-- Fix house edit permissions for admin and super_admin users.
-- Run this in the Supabase SQL Editor for the live project.

begin;

alter table public.houses
drop constraint if exists houses_status_check;

alter table public.houses
add constraint houses_status_check
check (status in ('available', 'booked', 'hold'));

alter table public.houses
add column if not exists extra_work text not null default '',
add column if not exists remarks text not null default '',
add column if not exists flooring text not null default '';

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(role)) from public.user_profiles where id = (select auth.uid());
$$;

drop policy if exists "Admins can manage profiles" on public.user_profiles;
create policy "Admins can manage profiles"
on public.user_profiles
for all
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

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

notify pgrst, 'reload schema';

commit;
