begin;

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

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
    where id = auth.uid()
      and role = 'admin'
      and admin_role = 'default_admin'
      and status = 'active'
      and not must_change_password
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
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
      and not must_change_password
  );
$$;

create or replace function private.current_user_can_manage_operations()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and admin_role in ('default_admin', 'ceo', 'director', 'it')
      and status = 'active'
      and not must_change_password
  );
$$;

revoke all on function private.current_user_is_default_admin() from public, anon;
revoke all on function private.current_user_is_admin() from public, anon;
revoke all on function private.current_user_can_manage_operations() from public, anon;
grant execute on function private.current_user_is_default_admin() to authenticated;
grant execute on function private.current_user_is_admin() to authenticated;
grant execute on function private.current_user_can_manage_operations() to authenticated;

commit;
