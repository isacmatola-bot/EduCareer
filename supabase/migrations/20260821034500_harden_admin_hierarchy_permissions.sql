begin;

-- Gate 2.1: make the administrative hierarchy explicit and enforce least-privilege
-- reads. Administrative writes remain permission-gated; account hierarchy is also
-- enforced in the account-management Edge Functions.

create table if not exists private.admin_role_hierarchy (
  admin_role text primary key,
  hierarchy_level integer not null check (hierarchy_level between 0 and 3),
  role_scope text not null check (role_scope in ('root', 'executive', 'department'))
);

revoke all on table private.admin_role_hierarchy from public, anon, authenticated;

delete from private.admin_role_hierarchy;
insert into private.admin_role_hierarchy (admin_role, hierarchy_level, role_scope) values
  ('default_admin', 0, 'root'),
  ('ceo', 1, 'executive'),
  ('director', 2, 'executive'),
  ('it', 3, 'department'),
  ('rh', 3, 'department'),
  ('finance', 3, 'department'),
  ('programs', 3, 'department'),
  ('opportunities', 3, 'department'),
  ('partnerships', 3, 'department'),
  ('support', 3, 'department'),
  ('statistics', 3, 'department');

-- The root account is a break-glass identity. There must never be a second root.
create unique index if not exists profiles_single_default_admin_idx
  on public.profiles (admin_role)
  where role = 'admin' and admin_role = 'default_admin';

alter table public.profiles
  drop constraint if exists profiles_admin_role_valid;

alter table public.profiles
  add constraint profiles_admin_role_valid
  check (
    (role = 'admin' and admin_role in (
      'default_admin', 'ceo', 'director', 'it', 'rh', 'finance', 'programs',
      'opportunities', 'partnerships', 'support', 'statistics'
    ))
    or
    (role <> 'admin' and admin_role is null)
  ) not valid;

alter table public.profiles validate constraint profiles_admin_role_valid;

-- Replace the original write-centric matrix with explicit read/manage scopes.
delete from private.admin_role_permissions;

insert into private.admin_role_permissions (admin_role, permission)
select leadership.admin_role, permissions.permission
from unnest(array['default_admin', 'ceo', 'director']) as leadership(admin_role)
cross join unnest(array[
  'accounts.read_all',
  'accounts.read_users',
  'accounts.maintain',
  'accounts.govern',
  'accounts.create_admin',
  'accounts.delete',
  'candidates.read',
  'candidates.manage',
  'partner_requests.read',
  'partner_requests.manage',
  'programs.read',
  'programs.manage',
  'opportunities.read',
  'opportunities.manage',
  'applications.read',
  'applications.manage',
  'placements.read',
  'placements.manage',
  'audit.read',
  'finance.read',
  'statistics.read_aggregate'
]) as permissions(permission);

insert into private.admin_role_permissions (admin_role, permission) values
  ('it', 'accounts.read_users'),
  ('it', 'accounts.maintain'),
  ('support', 'accounts.read_users'),
  ('support', 'accounts.maintain'),
  ('rh', 'candidates.read'),
  ('rh', 'candidates.manage'),
  ('rh', 'applications.read'),
  ('rh', 'applications.manage'),
  ('rh', 'placements.read'),
  ('rh', 'placements.manage'),
  ('finance', 'finance.read'),
  ('programs', 'programs.read'),
  ('programs', 'programs.manage'),
  ('opportunities', 'opportunities.read'),
  ('opportunities', 'opportunities.manage'),
  ('opportunities', 'applications.read'),
  ('opportunities', 'applications.manage'),
  ('opportunities', 'placements.read'),
  ('opportunities', 'placements.manage'),
  ('partnerships', 'partner_requests.read'),
  ('partnerships', 'partner_requests.manage'),
  ('statistics', 'statistics.read_aggregate');

-- Profiles: leadership can read all accounts; IT/Support can read only public-user
-- accounts. Every user can still read their own profile so MFA enrollment and
-- self-service continue to work before an administrator reaches AAL2.
drop policy if exists "Profiles are visible to owner and admins" on public.profiles;
drop policy if exists "Profiles are visible by ownership or account scope" on public.profiles;
create policy "Profiles are visible by ownership or account scope"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.current_user_has_permission('accounts.read_all'))
  or (
    role <> 'admin'
    and (select private.current_user_has_permission('accounts.read_users'))
  )
);

-- Candidate records are no longer a collective-admin dataset.
drop policy if exists "Candidates are visible to owner and admins" on public.candidates;
drop policy if exists "Candidates are visible to owner or authorized readers" on public.candidates;
create policy "Candidates are visible to owner or authorized readers"
on public.candidates for select to authenticated
using (
  account_id = (select auth.uid())
  or (select private.current_user_has_permission('candidates.read'))
);

-- Partner requests are visible only to the owner or the partnership/executive scope.
drop policy if exists "Partner requests are visible to owner and admins" on public.partner_requests;
drop policy if exists "Partner requests are visible to owner or authorized readers" on public.partner_requests;
create policy "Partner requests are visible to owner or authorized readers"
on public.partner_requests for select to authenticated
using (
  account_id = (select auth.uid())
  or (select private.current_user_has_permission('partner_requests.read'))
);

-- Applications are visible only to the applicant or roles responsible for them.
drop policy if exists "Applications are visible to owner and admins" on public.opportunity_applications;
drop policy if exists "Applications are visible to owner or authorized readers" on public.opportunity_applications;
create policy "Applications are visible to owner or authorized readers"
on public.opportunity_applications for select to authenticated
using (
  account_id = (select auth.uid())
  or (select private.current_user_has_permission('applications.read'))
);

-- Unpublished programs/opportunities are departmental data, not generic admin data.
drop policy if exists "Authenticated users can read permitted programs" on public.programs;
drop policy if exists "Admins can read all programs" on public.programs;
drop policy if exists "Authenticated users can read published or authorized programs" on public.programs;
create policy "Authenticated users can read published or authorized programs"
on public.programs for select to authenticated
using (
  status = 'published'
  or (select private.current_user_has_permission('programs.read'))
);

drop policy if exists "Authenticated users can read permitted opportunities" on public.opportunities;
drop policy if exists "Admins can read all opportunities" on public.opportunities;
drop policy if exists "Authenticated users can read public or authorized opportunities" on public.opportunities;
create policy "Authenticated users can read public or authorized opportunities"
on public.opportunities for select to authenticated
using (
  status in ('open', 'upcoming')
  or (select private.current_user_has_permission('opportunities.read'))
);

-- Placements had RLS policies but no authenticated table grants. Restore the Data
-- API object privileges and let RLS provide the row/action authorization layer.
grant select, insert, update, delete on table public.placements to authenticated;

drop policy if exists "Admins can read placements" on public.placements;
drop policy if exists "Authorized admins can read placements" on public.placements;
create policy "Authorized admins can read placements"
on public.placements for select to authenticated
using ((select private.current_user_has_permission('placements.read')));

comment on table private.admin_role_hierarchy is
  'Canonical EduCareer administrative hierarchy: root, executive, and department levels.';
comment on table private.admin_role_permissions is
  'Canonical EduCareer least-privilege RBAC matrix. Read and manage permissions are separated by domain.';

commit;
