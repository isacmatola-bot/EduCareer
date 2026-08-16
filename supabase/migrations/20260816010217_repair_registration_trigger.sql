-- Repair EduCareer public account registration after GitHub/Vercel merges.
--
-- This migration is intentionally idempotent. It removes every non-system
-- trigger on auth.users that invokes public.handle_new_user(), then installs
-- one canonical trigger. Multiple trigger names pointing at the same function
-- execute the registration workflow more than once and can surface in the
-- client as "Database error creating new user".

begin;

do $$
declare
  duplicate_trigger record;
begin
  for duplicate_trigger in
    select trigger_record.tgname
    from pg_trigger trigger_record
    join pg_proc function_record
      on function_record.oid = trigger_record.tgfoid
    join pg_namespace function_schema
      on function_schema.oid = function_record.pronamespace
    where trigger_record.tgrelid = 'auth.users'::regclass
      and not trigger_record.tgisinternal
      and function_schema.nspname = 'public'
      and function_record.proname = 'handle_new_user'
  loop
    execute format(
      'drop trigger if exists %I on auth.users',
      duplicate_trigger.tgname
    );
  end loop;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

commit;
