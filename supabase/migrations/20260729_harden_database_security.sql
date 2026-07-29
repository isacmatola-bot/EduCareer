-- Harden EduCareer database functions and remove confirmed legacy automation.
--
-- The legacy functions are dropped only when they have no table trigger,
-- event trigger, or extension dependency. If a dependency still exists, the
-- migration raises an exception instead of silently breaking production.

begin;

alter function public.touch_updated_at() set search_path = public;

revoke execute on function public.touch_updated_at()
from public, anon, authenticated;
revoke execute on function public.handle_new_user()
from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.sync_profile_auth_user_id()') is not null then
    execute
      'revoke execute on function public.sync_profile_auth_user_id() '
      'from public, anon, authenticated';
  end if;
end;
$$;

revoke execute on function public.current_user_is_default_admin()
from public, anon;
revoke execute on function public.current_user_is_admin()
from public, anon;
revoke execute on function public.current_user_can_manage_operations()
from public, anon;
grant execute on function public.current_user_is_default_admin()
to authenticated;
grant execute on function public.current_user_is_admin()
to authenticated;
grant execute on function public.current_user_can_manage_operations()
to authenticated;

revoke execute on function public.get_login_email(text) from public;
grant execute on function public.get_login_email(text) to anon, authenticated;

do $$
declare
  legacy_function_name text;
  legacy_function_oid oid;
  has_dependency boolean;
begin
  foreach legacy_function_name in array array[
    'handle_new_educareer_user',
    'rls_auto_enable'
  ]
  loop
    legacy_function_oid :=
      to_regprocedure(format('public.%I()', legacy_function_name));

    if legacy_function_oid is null then
      continue;
    end if;

    select
      exists (
        select 1
        from pg_trigger
        where tgfoid = legacy_function_oid
          and not tgisinternal
      )
      or exists (
        select 1
        from pg_event_trigger
        where evtfoid = legacy_function_oid
      )
      or exists (
        select 1
        from pg_depend
        where objid = legacy_function_oid
          and deptype = 'e'
      )
    into has_dependency;

    if has_dependency then
      raise exception
        'Refusing to remove legacy function public.%(): active dependency found',
        legacy_function_name;
    end if;

    execute format('drop function public.%I()', legacy_function_name);
  end loop;
end;
$$;

commit;
