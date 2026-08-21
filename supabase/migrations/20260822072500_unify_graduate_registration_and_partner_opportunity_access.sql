begin;

-- Graduate account approval is a registration workflow, separate from later career
-- or opportunity-application states. Keep this workflow synchronized with profiles.status.
alter table public.candidates
  add column if not exists registration_status text not null default 'submitted',
  add column if not exists registration_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists registration_reviewed_at timestamptz;

do $$
begin
  alter table public.candidates
    add constraint candidates_registration_status_check
    check (registration_status in ('submitted', 'reviewing', 'approved', 'rejected'));
exception
  when duplicate_object then null;
end $$;

-- Existing production graduate profiles are the best available source for the
-- initial registration decision. A security-disabled account does not erase its
-- underlying registration decision.
update public.candidates c
set registration_status = case p.status
      when 'active' then 'approved'
      when 'rejected' then 'rejected'
      else c.registration_status
    end,
    registration_reviewed_at = case
      when p.status in ('active', 'rejected') then coalesce(c.registration_reviewed_at, p.updated_at, now())
      else c.registration_reviewed_at
    end,
    updated_at = now()
from public.profiles p
where p.id = c.account_id
  and p.role = 'graduate'
  and p.status in ('active', 'rejected');

create or replace function public.list_graduate_registrations_for_admin()
returns table (
  id uuid,
  account_id uuid,
  registration_status text,
  created_at timestamptz,
  updated_at timestamptz,
  full_name text,
  username text,
  email text,
  institution text,
  qualification text,
  teaching_area text
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.current_user_has_permission('candidates.read') then
    raise exception 'You do not have permission to read graduate registrations.' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.account_id,
    c.registration_status,
    c.created_at,
    c.updated_at,
    c.full_name,
    coalesce(c.username, ''),
    c.email,
    c.institution,
    c.qualification,
    c.teaching_area
  from public.candidates c
  order by c.created_at desc;
end;
$$;

create or replace function public.review_graduate_registration(
  p_candidate_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_candidate public.candidates%rowtype;
  v_previous_status text;
  v_profile_status text;
begin
  if not private.current_user_has_permission('candidates.manage') then
    raise exception 'You do not have permission to review graduate registrations.' using errcode = '42501';
  end if;

  if p_status not in ('reviewing', 'approved', 'rejected') then
    raise exception 'Invalid graduate registration review status.' using errcode = '22023';
  end if;

  select *
  into v_candidate
  from public.candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'Graduate registration not found.' using errcode = 'P0002';
  end if;

  if v_candidate.account_id is null then
    raise exception 'Graduate registration is not linked to an account.' using errcode = '23503';
  end if;

  if v_candidate.registration_status = 'submitted' and p_status <> 'reviewing' then
    raise exception 'Submitted graduate registrations must enter reviewing before a final decision.' using errcode = '22023';
  end if;

  if v_candidate.registration_status = 'reviewing' and p_status not in ('approved', 'rejected') then
    raise exception 'Graduate registrations under review must be approved or rejected.' using errcode = '22023';
  end if;

  if v_candidate.registration_status in ('approved', 'rejected') then
    raise exception 'This graduate registration is already in a terminal state.' using errcode = '22023';
  end if;

  v_previous_status := v_candidate.registration_status;
  v_profile_status := case p_status
    when 'approved' then 'active'
    when 'rejected' then 'rejected'
    else 'pending'
  end;

  update public.candidates
  set registration_status = p_status,
      registration_reviewed_by = auth.uid(),
      registration_reviewed_at = now(),
      updated_at = now()
  where id = p_candidate_id
  returning * into v_candidate;

  update public.profiles
  set status = v_profile_status,
      updated_at = now()
  where id = v_candidate.account_id
    and role = 'graduate';

  if not found then
    raise exception 'Linked graduate account not found.' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log(actor_id, target_id, action, details)
  values (
    auth.uid(),
    v_candidate.account_id,
    'graduate_registration.status_changed',
    jsonb_build_object(
      'candidate_id', v_candidate.id,
      'previous_status', v_previous_status,
      'new_status', v_candidate.registration_status,
      'profile_status', v_profile_status
    )
  );

  return jsonb_build_object(
    'id', v_candidate.id,
    'status', v_candidate.registration_status,
    'profile_status', v_profile_status,
    'reviewed_at', v_candidate.registration_reviewed_at
  );
end;
$$;

revoke all on function public.list_graduate_registrations_for_admin() from public, anon;
revoke all on function public.review_graduate_registration(uuid, text) from public, anon;
grant execute on function public.list_graduate_registrations_for_admin() to authenticated;
grant execute on function public.review_graduate_registration(uuid, text) to authenticated;

-- Safety backstops keep profile/account access and graduate registration decisions
-- synchronized even if a privileged maintenance path writes profiles.status directly.
create or replace function private.sync_graduate_registration_from_profile_status()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_candidate public.candidates%rowtype;
begin
  if new.role <> 'graduate' or new.status is not distinct from old.status then
    return new;
  end if;

  select *
  into v_candidate
  from public.candidates
  where account_id = new.id
  order by created_at desc
  limit 1
  for update;

  if not found then
    return new;
  end if;

  if new.status = 'active' then
    if v_candidate.registration_status = 'rejected' then
      raise exception 'A rejected graduate registration cannot be activated from profile management.' using errcode = '22023';
    end if;
    if v_candidate.registration_status in ('submitted', 'reviewing') then
      update public.candidates
      set registration_status = 'approved',
          registration_reviewed_by = coalesce(registration_reviewed_by, auth.uid()),
          registration_reviewed_at = now(),
          updated_at = now()
      where id = v_candidate.id;
    end if;
  elsif new.status = 'rejected' then
    if v_candidate.registration_status = 'approved' then
      raise exception 'An approved graduate registration cannot be rejected from profile management.' using errcode = '22023';
    end if;
    if v_candidate.registration_status in ('submitted', 'reviewing') then
      update public.candidates
      set registration_status = 'rejected',
          registration_reviewed_by = coalesce(registration_reviewed_by, auth.uid()),
          registration_reviewed_at = now(),
          updated_at = now()
      where id = v_candidate.id;
    end if;
  elsif new.status = 'pending' and v_candidate.registration_status in ('approved', 'rejected') then
    raise exception 'A final graduate registration decision cannot be reverted to pending from profile management.' using errcode = '22023';
  end if;

  return new;
end;
$$;

create or replace function private.sync_graduate_profile_from_registration_status()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_profile_status text;
begin
  if new.account_id is null or new.registration_status is not distinct from old.registration_status then
    return new;
  end if;

  v_profile_status := case new.registration_status
    when 'approved' then 'active'
    when 'rejected' then 'rejected'
    else 'pending'
  end;

  if new.registration_status = 'approved' and exists (
    select 1 from public.profiles
    where id = new.account_id and role = 'graduate' and status = 'disabled'
  ) then
    return new;
  end if;

  update public.profiles
  set status = v_profile_status,
      updated_at = now()
  where id = new.account_id
    and role = 'graduate'
    and status is distinct from v_profile_status;

  return new;
end;
$$;

revoke all on function private.sync_graduate_registration_from_profile_status() from public, anon, authenticated;
revoke all on function private.sync_graduate_profile_from_registration_status() from public, anon, authenticated;

drop trigger if exists sync_graduate_registration_from_profile_status on public.profiles;
create trigger sync_graduate_registration_from_profile_status
after update of status on public.profiles
for each row execute function private.sync_graduate_registration_from_profile_status();

drop trigger if exists sync_graduate_profile_from_registration_status on public.candidates;
create trigger sync_graduate_profile_from_registration_status
after update of registration_status on public.candidates
for each row execute function private.sync_graduate_profile_from_registration_status();

-- Track opportunity ownership. Existing EduCareer/admin-created opportunities remain
-- unowned (NULL); new authenticated creates record the creating account in the client.
alter table public.opportunities
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

-- Opportunities are member-only content. Visitors and pending/rejected/disabled accounts
-- must not be able to retrieve them through the Data API.
drop policy if exists "Public can read open opportunities" on public.opportunities;
drop policy if exists "Authenticated users can read public or authorized opportunities" on public.opportunities;
revoke select on table public.opportunities from anon;

create policy "Active accounts can read opportunities"
on public.opportunities for select to authenticated
using (
  (
    status in ('open', 'upcoming')
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.status = 'active'
    )
  )
  or (select private.current_user_has_permission('opportunities.read'))
  or (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'partner'
        and p.status = 'active'
    )
  )
);

-- Existing admin policies remain in place. These additional policies let an active
-- Partner create and manage only opportunities owned by that same Partner account.
drop policy if exists "Active partners can insert own opportunities" on public.opportunities;
create policy "Active partners can insert own opportunities"
on public.opportunities for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'partner'
      and p.status = 'active'
  )
);

drop policy if exists "Active partners can update own opportunities" on public.opportunities;
create policy "Active partners can update own opportunities"
on public.opportunities for update to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'partner'
      and p.status = 'active'
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'partner'
      and p.status = 'active'
  )
);

drop policy if exists "Active partners can delete own opportunities" on public.opportunities;
create policy "Active partners can delete own opportunities"
on public.opportunities for delete to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'partner'
      and p.status = 'active'
  )
);

-- Realtime lets authorized dashboard sessions see new graduate requests and lets
-- active members see newly-published opportunities without weakening RLS.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'candidates'
    ) then
      alter publication supabase_realtime add table public.candidates;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'opportunities'
    ) then
      alter publication supabase_realtime add table public.opportunities;
    end if;
  end if;
end $$;

comment on function public.review_graduate_registration(uuid, text) is
  'Canonical Graduate registration state machine: submitted -> reviewing -> approved/rejected, synchronized with account access and audited.';
comment on column public.opportunities.created_by is
  'Account that created the opportunity. Active Partners may manage only rows they own.';

commit;
