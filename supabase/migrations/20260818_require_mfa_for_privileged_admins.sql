-- Require AAL2 for permissions held by accounts with high-impact account
-- administration capabilities. Departmental read access remains available at
-- AAL1 so users can reach the MFA enrollment/challenge flow safely.

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
      and (
        profile.admin_role not in ('default_admin', 'ceo', 'director', 'it', 'support')
        or (select auth.jwt() ->> 'aal') = 'aal2'
      )
  );
$$;

revoke all on function private.current_user_has_permission(text) from public, anon;
grant execute on function private.current_user_has_permission(text) to authenticated;

comment on function private.current_user_has_permission(text) is
  'Checks active role permissions and requires AAL2 for privileged EduCareer administrators.';
