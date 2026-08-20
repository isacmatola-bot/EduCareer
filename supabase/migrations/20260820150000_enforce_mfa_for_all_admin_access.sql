-- Require AAL2 for every administrative session before any collective admin
-- read or privileged write is authorized. Owners retain their own non-admin
-- access through the existing RLS owner predicates.

begin;

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
      and (select auth.jwt() ->> 'aal') = 'aal2'
  );
$$;

create or replace function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and status = 'active'
      and not must_change_password
      and (select auth.jwt() ->> 'aal') = 'aal2'
  );
$$;

create or replace function private.current_user_is_default_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and admin_role = 'default_admin'
      and status = 'active'
      and not must_change_password
      and (select auth.jwt() ->> 'aal') = 'aal2'
  );
$$;

revoke all on function private.current_user_has_permission(text) from public, anon;
revoke all on function private.current_user_is_admin() from public, anon;
revoke all on function private.current_user_is_default_admin() from public, anon;

grant execute on function private.current_user_has_permission(text) to authenticated;
grant execute on function private.current_user_is_admin() to authenticated;
grant execute on function private.current_user_is_default_admin() to authenticated;

comment on function private.current_user_has_permission(text) is
  'Checks active EduCareer admin role permissions and requires an AAL2 session.';
comment on function private.current_user_is_admin() is
  'Returns true only for active EduCareer administrators using an AAL2 session.';
comment on function private.current_user_is_default_admin() is
  'Returns true only for the active default administrator using an AAL2 session.';

commit;
