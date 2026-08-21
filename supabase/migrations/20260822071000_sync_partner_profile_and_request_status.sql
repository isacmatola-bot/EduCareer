begin;

-- Keep partner registration decisions consistent regardless of whether an authorized
-- administrator acts from the operational Dashboard or from Portal -> Manage Accounts.
-- The latest partner request remains the registration workflow record; profiles.status
-- remains the account-access state.

create or replace function private.sync_partner_request_from_profile_status()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_request public.partner_requests%rowtype;
begin
  if new.role <> 'partner' or new.status is not distinct from old.status then
    return new;
  end if;

  select *
  into v_request
  from public.partner_requests
  where account_id = new.id
  order by created_at desc
  limit 1
  for update;

  if not found then
    return new;
  end if;

  if new.status = 'active' then
    if v_request.status = 'rejected' then
      raise exception 'A rejected partner registration cannot be activated from profile management.' using errcode = '22023';
    end if;

    if v_request.status in ('submitted', 'reviewing') then
      update public.partner_requests
      set status = 'approved',
          reviewed_by = coalesce(reviewed_by, auth.uid()),
          reviewed_at = now(),
          updated_at = now()
      where id = v_request.id;
    end if;
  elsif new.status = 'rejected' then
    if v_request.status = 'approved' then
      raise exception 'An approved partner registration cannot be rejected from profile management.' using errcode = '22023';
    end if;

    if v_request.status in ('submitted', 'reviewing') then
      update public.partner_requests
      set status = 'rejected',
          reviewed_by = coalesce(reviewed_by, auth.uid()),
          reviewed_at = now(),
          updated_at = now()
      where id = v_request.id;
    end if;
  elsif new.status = 'pending' and v_request.status in ('approved', 'rejected') then
    raise exception 'A final partner registration decision cannot be reverted to pending from profile management.' using errcode = '22023';
  end if;

  return new;
end;
$$;

create or replace function private.sync_partner_profile_from_request_status()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_profile_status text;
begin
  if new.account_id is null or new.status is not distinct from old.status then
    return new;
  end if;

  v_profile_status := case new.status
    when 'approved' then 'active'
    when 'rejected' then 'rejected'
    else 'pending'
  end;

  -- A deliberate security block remains stronger than an approval decision. The
  -- registration can stay approved while account access remains disabled.
  if new.status = 'approved' and exists (
    select 1
    from public.profiles
    where id = new.account_id
      and role = 'partner'
      and status = 'disabled'
  ) then
    return new;
  end if;

  update public.profiles
  set status = v_profile_status,
      updated_at = now()
  where id = new.account_id
    and role = 'partner'
    and status is distinct from v_profile_status;

  return new;
end;
$$;

revoke all on function private.sync_partner_request_from_profile_status() from public, anon, authenticated;
revoke all on function private.sync_partner_profile_from_request_status() from public, anon, authenticated;

drop trigger if exists sync_partner_request_from_profile_status on public.profiles;
create trigger sync_partner_request_from_profile_status
after update of status on public.profiles
for each row
execute function private.sync_partner_request_from_profile_status();

drop trigger if exists sync_partner_profile_from_request_status on public.partner_requests;
create trigger sync_partner_profile_from_request_status
after update of status on public.partner_requests
for each row
execute function private.sync_partner_profile_from_request_status();

-- Repair existing mismatches. If a profile decision was written after a non-terminal
-- request state, treat the later profile action as the administrator's final decision.
update public.partner_requests pr
set status = case p.status
      when 'active' then 'approved'
      when 'rejected' then 'rejected'
      else pr.status
    end,
    reviewed_at = case
      when p.status in ('active', 'rejected') then coalesce(pr.reviewed_at, p.updated_at, now())
      else pr.reviewed_at
    end,
    updated_at = now()
from public.profiles p
where p.id = pr.account_id
  and p.role = 'partner'
  and pr.status in ('submitted', 'reviewing')
  and p.status in ('active', 'rejected')
  and p.updated_at > pr.updated_at;

-- Final request decisions are authoritative for access, except that an explicit block
-- remains disabled after approval.
update public.profiles p
set status = case pr.status
      when 'approved' then 'active'
      when 'rejected' then 'rejected'
      else p.status
    end,
    updated_at = now()
from public.partner_requests pr
where pr.account_id = p.id
  and p.role = 'partner'
  and pr.status in ('approved', 'rejected')
  and not (pr.status = 'approved' and p.status = 'disabled')
  and p.status is distinct from case pr.status
    when 'approved' then 'active'
    when 'rejected' then 'rejected'
    else p.status
  end;

-- Publish administrative workflow tables so authorized browser sessions can subscribe
-- to changes. RLS remains responsible for deciding which rows each administrator may see.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
    ) then
      alter publication supabase_realtime add table public.profiles;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'partner_requests'
    ) then
      alter publication supabase_realtime add table public.partner_requests;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'opportunity_applications'
    ) then
      alter publication supabase_realtime add table public.opportunity_applications;
    end if;
  end if;
end $$;

comment on function private.sync_partner_request_from_profile_status() is
  'Synchronizes partner registration workflow decisions when an authorized account-management path changes profiles.status.';
comment on function private.sync_partner_profile_from_request_status() is
  'Synchronizes partner account access when the operational partner-request workflow changes status.';

commit;
