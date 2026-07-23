-- Keep legacy `auth_user_id` installations aligned with the canonical
-- `profiles.id = auth.users.id` account identity used by EduCareer.
-- Safe to run repeatedly.

begin;

alter table public.profiles
  add column if not exists auth_user_id uuid;

update public.profiles profiles
set auth_user_id = profiles.id
where profiles.auth_user_id is null
  and exists (
    select 1
    from auth.users users
    where users.id = profiles.id
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_record
    where constraint_record.contype = 'u'
      and constraint_record.conrelid = 'public.profiles'::regclass
      and constraint_record.conkey = array[
        (
          select attribute.attnum
          from pg_attribute attribute
          where attribute.attrelid = 'public.profiles'::regclass
            and attribute.attname = 'auth_user_id'
            and not attribute.attisdropped
        )
      ]::smallint[]
  ) then
    alter table public.profiles
      add constraint profiles_auth_user_id_key unique (auth_user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint foreign_key
    join pg_attribute source_attribute
      on source_attribute.attrelid = foreign_key.conrelid
     and source_attribute.attnum = foreign_key.conkey[1]
    join pg_attribute target_attribute
      on target_attribute.attrelid = foreign_key.confrelid
     and target_attribute.attnum = foreign_key.confkey[1]
    where foreign_key.contype = 'f'
      and foreign_key.conrelid = 'public.profiles'::regclass
      and foreign_key.confrelid = 'auth.users'::regclass
      and cardinality(foreign_key.conkey) = 1
      and source_attribute.attname = 'auth_user_id'
      and target_attribute.attname = 'id'
  ) then
    alter table public.profiles
      add constraint profiles_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users(id)
      on delete cascade;
  end if;
end;
$$;

-- Any profile creation path that only supplies `id` is automatically kept
-- compatible with older installations that also expose `auth_user_id`.
create or replace function public.sync_profile_auth_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.auth_user_id := new.id;
  return new;
end;
$$;

drop trigger if exists sync_profile_auth_user_id on public.profiles;
create trigger sync_profile_auth_user_id
before insert or update of id, auth_user_id on public.profiles
for each row execute function public.sync_profile_auth_user_id();

-- Do not make the column NOT NULL until the migration proves that all existing
-- rows are connected to Auth. This produces a clear error instead of partially
-- applying the migration.
do $$
begin
  if exists (
    select 1
    from public.profiles profiles
    where profiles.auth_user_id is null
       or profiles.auth_user_id <> profiles.id
  ) then
    raise exception 'Cannot finalize profile/Auth alignment: inconsistent profiles remain.';
  end if;

  alter table public.profiles
    alter column auth_user_id set not null;
end;
$$;

commit;
