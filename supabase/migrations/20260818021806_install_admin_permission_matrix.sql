-- Replace the coarse operational-admin switch with explicit, auditable
-- permissions. Authorization data remains in the private schema and is never
-- accepted from user-editable Auth metadata.

create schema if not exists private;

create table if not exists private.admin_role_permissions (
  admin_role text not null,
  permission text not null,
  primary key (admin_role, permission)
);

revoke all on table private.admin_role_permissions from public, anon, authenticated;

delete from private.admin_role_permissions;

insert into private.admin_role_permissions (admin_role, permission)
select leadership.admin_role, permissions.permission
from unnest(array['default_admin', 'ceo', 'director']) as leadership(admin_role)
cross join unnest(array[
  'accounts.maintain',
  'accounts.govern',
  'accounts.create_admin',
  'accounts.delete',
  'candidates.manage',
  'partner_requests.manage',
  'programs.manage',
  'opportunities.manage',
  'applications.manage',
  'placements.manage',
  'audit.read'
]) as permissions(permission);

insert into private.admin_role_permissions (admin_role, permission) values
  ('it', 'accounts.maintain'),
  ('support', 'accounts.maintain'),
  ('rh', 'candidates.manage'),
  ('rh', 'applications.manage'),
  ('rh', 'placements.manage'),
  ('programs', 'programs.manage'),
  ('opportunities', 'opportunities.manage'),
  ('opportunities', 'applications.manage'),
  ('opportunities', 'placements.manage'),
  ('partnerships', 'partner_requests.manage');

create or replace function private.current_user_has_permission(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    join private.admin_role_permissions role_permission
      on role_permission.admin_role = profile.admin_role
    where profile.id = (select auth.uid())
      and profile.role = 'admin'
      and profile.status = 'active'
      and not profile.must_change_password
      and role_permission.permission = requested_permission
  );
$$;

revoke all on function private.current_user_has_permission(text) from public, anon;
grant execute on function private.current_user_has_permission(text) to authenticated;

-- Preserve the legacy helper for older clients while removing IT's unrelated
-- content privileges. New policies below use named permissions directly.
create or replace function private.current_user_can_manage_operations()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_user_has_permission('programs.manage')
      or private.current_user_has_permission('opportunities.manage');
$$;

revoke all on function private.current_user_can_manage_operations() from public, anon;
grant execute on function private.current_user_can_manage_operations() to authenticated;

-- Profile mutations are intentionally available only through authenticated
-- Edge Functions, where field-level and target-account restrictions are
-- enforced. RLS alone cannot prevent an allowed UPDATE from changing a role.
drop policy if exists "Operational admins can update permitted profiles" on public.profiles;
revoke update on table public.profiles from authenticated;
revoke update (display_name, phone, status) on public.profiles from authenticated;

drop policy if exists "Admins can update candidate status" on public.candidates;
create policy "Authorized admins can update candidate status"
on public.candidates for update to authenticated
using (private.current_user_has_permission('candidates.manage'))
with check (private.current_user_has_permission('candidates.manage'));

drop policy if exists "Admins can update partner request status" on public.partner_requests;
create policy "Authorized admins can update partner requests"
on public.partner_requests for update to authenticated
using (private.current_user_has_permission('partner_requests.manage'))
with check (private.current_user_has_permission('partner_requests.manage'));

drop policy if exists "Public can read open opportunities" on public.opportunities;
create policy "Public can read open opportunities"
on public.opportunities for select to anon, authenticated
using (status in ('open', 'upcoming'));

create policy "Admins can read all opportunities"
on public.opportunities for select to authenticated
using (private.current_user_is_admin());

drop policy if exists "Admins can manage opportunities" on public.opportunities;
create policy "Authorized admins can manage opportunities"
on public.opportunities for all to authenticated
using (private.current_user_has_permission('opportunities.manage'))
with check (private.current_user_has_permission('opportunities.manage'));

drop policy if exists "Public can read published programs" on public.programs;
create policy "Public can read published programs"
on public.programs for select to anon, authenticated
using (status = 'published');

create policy "Admins can read all programs"
on public.programs for select to authenticated
using (private.current_user_is_admin());

drop policy if exists "Operational admins can manage programs" on public.programs;
create policy "Authorized admins can manage programs"
on public.programs for all to authenticated
using (private.current_user_has_permission('programs.manage'))
with check (private.current_user_has_permission('programs.manage'));

drop policy if exists "Applications are visible to owner and operational admins" on public.opportunity_applications;
create policy "Applications are visible to owner and admins"
on public.opportunity_applications for select to authenticated
using (
  account_id = (select auth.uid())
  or private.current_user_is_admin()
);

drop policy if exists "Operational admins can update applications" on public.opportunity_applications;
create policy "Authorized admins can update applications"
on public.opportunity_applications for update to authenticated
using (private.current_user_has_permission('applications.manage'))
with check (private.current_user_has_permission('applications.manage'));

drop policy if exists "Admins can manage placements" on public.placements;
create policy "Admins can read placements"
on public.placements for select to authenticated
using (private.current_user_is_admin());

create policy "Authorized admins can manage placements"
on public.placements for all to authenticated
using (private.current_user_has_permission('placements.manage'))
with check (private.current_user_has_permission('placements.manage'));

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  target_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from public, anon, authenticated;
grant select on table public.admin_audit_log to authenticated;
grant select, insert on table public.admin_audit_log to service_role;

drop policy if exists "Executives can read administrative audit logs" on public.admin_audit_log;
create policy "Executives can read administrative audit logs"
on public.admin_audit_log for select to authenticated
using (private.current_user_has_permission('audit.read'));

create index if not exists admin_audit_log_actor_created_idx
  on public.admin_audit_log (actor_id, created_at desc);
create index if not exists admin_audit_log_target_created_idx
  on public.admin_audit_log (target_id, created_at desc)
  where target_id is not null;

comment on table private.admin_role_permissions is
  'Canonical EduCareer administrative role-to-permission matrix.';
comment on table public.admin_audit_log is
  'Immutable record of privileged administrative account operations.';
