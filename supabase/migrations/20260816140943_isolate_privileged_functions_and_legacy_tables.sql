create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;

alter function public.current_user_can_manage_operations() set schema private;
alter function private.current_user_can_manage_operations() set search_path = '';

alter function public.current_user_is_admin() set schema private;
alter function private.current_user_is_admin() set search_path = '';

alter function public.current_user_is_default_admin() set schema private;
alter function private.current_user_is_default_admin() set search_path = '';

alter function public.get_login_email(text) set schema private;
alter function private.get_login_email(text) rename to resolve_login_email;
alter function private.resolve_login_email(text) set search_path = '';

alter function public.handle_new_user() set schema private;
alter function private.handle_new_user() set search_path = '';

alter function public.sync_profile_auth_user_id() set schema private;
alter function private.sync_profile_auth_user_id() set search_path = '';

alter function public.sync_profile_email_from_auth() set schema private;
alter function private.sync_profile_email_from_auth() set search_path = '';

alter function public.rls_auto_enable() set schema private;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_user_can_manage_operations() to authenticated;
grant execute on function private.current_user_is_admin() to authenticated;
grant execute on function private.current_user_is_default_admin() to authenticated;
grant execute on function private.resolve_login_email(text) to anon, authenticated;

create function public.get_login_email(login_username text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.resolve_login_email(login_username);
$$;

revoke all on function public.get_login_email(text) from public;
grant execute on function public.get_login_email(text) to anon, authenticated;

create schema if not exists legacy;
revoke all on schema legacy from public, anon, authenticated;

alter table public.applications set schema legacy;
alter table public.registrations set schema legacy;
alter table public.companies set schema legacy;
alter table public.students set schema legacy;
alter table public.events set schema legacy;
alter table public.workshops set schema legacy;
alter table public.contact_messages set schema legacy;

revoke all on all tables in schema legacy from public, anon, authenticated;
revoke all on all sequences in schema legacy from public, anon, authenticated;
revoke all on all functions in schema legacy from public, anon, authenticated;
