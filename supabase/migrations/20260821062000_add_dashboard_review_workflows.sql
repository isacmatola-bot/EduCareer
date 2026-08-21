begin;

alter table public.partner_requests
  add column if not exists status text not null default 'submitted',
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

do $$
begin
  alter table public.partner_requests
    add constraint partner_requests_status_check
    check (status in ('submitted', 'reviewing', 'approved', 'rejected'));
exception
  when duplicate_object then null;
end $$;

update public.partner_requests pr
set status = case p.status
  when 'active' then 'approved'
  when 'rejected' then 'rejected'
  else 'submitted'
end
from public.profiles p
where p.id = pr.account_id
  and pr.status = 'submitted';

create or replace function public.list_opportunity_applications_for_admin()
returns table (
  id uuid,
  opportunity_id uuid,
  account_id uuid,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  applicant_name text,
  applicant_username text,
  applicant_email text,
  opportunity_title text
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.current_user_has_permission('applications.read') then
    raise exception 'You do not have permission to read applications.' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    a.opportunity_id,
    a.account_id,
    a.status,
    a.created_at,
    a.updated_at,
    coalesce(p.display_name, p.full_name, p.username, 'Graduate') as applicant_name,
    coalesce(p.username, '') as applicant_username,
    coalesce(p.email, '') as applicant_email,
    coalesce(o.title, 'Opportunity') as opportunity_title
  from public.opportunity_applications a
  join public.profiles p on p.id = a.account_id
  left join public.opportunities o on o.id = a.opportunity_id
  order by a.created_at desc;
end;
$$;

create or replace function public.review_opportunity_application(
  p_application_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_application public.opportunity_applications%rowtype;
  v_previous_status text;
begin
  if not private.current_user_has_permission('applications.manage') then
    raise exception 'You do not have permission to review applications.' using errcode = '42501';
  end if;

  if p_status not in ('reviewing', 'accepted', 'rejected') then
    raise exception 'Invalid application review status.' using errcode = '22023';
  end if;

  select *
  into v_application
  from public.opportunity_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found.' using errcode = 'P0002';
  end if;

  if v_application.status = 'withdrawn' then
    raise exception 'Withdrawn applications cannot be reviewed.' using errcode = '22023';
  end if;

  v_previous_status := v_application.status;

  update public.opportunity_applications
  set status = p_status,
      updated_at = now()
  where id = p_application_id
  returning * into v_application;

  insert into public.admin_audit_log(actor_id, target_id, action, details)
  values (
    auth.uid(),
    v_application.account_id,
    'opportunity_application.status_changed',
    jsonb_build_object(
      'application_id', v_application.id,
      'opportunity_id', v_application.opportunity_id,
      'previous_status', v_previous_status,
      'new_status', v_application.status
    )
  );

  return jsonb_build_object(
    'id', v_application.id,
    'status', v_application.status,
    'updated_at', v_application.updated_at
  );
end;
$$;

create or replace function public.review_partner_request(
  p_request_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_request public.partner_requests%rowtype;
  v_previous_status text;
  v_profile_status text;
begin
  if not private.current_user_has_permission('partner_requests.manage') then
    raise exception 'You do not have permission to review partner requests.' using errcode = '42501';
  end if;

  if p_status not in ('reviewing', 'approved', 'rejected') then
    raise exception 'Invalid partner request review status.' using errcode = '22023';
  end if;

  select *
  into v_request
  from public.partner_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Partner request not found.' using errcode = 'P0002';
  end if;

  if v_request.account_id is null then
    raise exception 'Partner request is not linked to an account.' using errcode = '23503';
  end if;

  v_previous_status := v_request.status;
  v_profile_status := case p_status
    when 'approved' then 'active'
    when 'rejected' then 'rejected'
    else 'pending'
  end;

  update public.partner_requests
  set status = p_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  update public.profiles
  set status = v_profile_status,
      updated_at = now()
  where id = v_request.account_id
    and role = 'partner';

  if not found then
    raise exception 'Linked partner account not found.' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log(actor_id, target_id, action, details)
  values (
    auth.uid(),
    v_request.account_id,
    'partner_request.status_changed',
    jsonb_build_object(
      'request_id', v_request.id,
      'previous_status', v_previous_status,
      'new_status', v_request.status,
      'profile_status', v_profile_status
    )
  );

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'profile_status', v_profile_status,
    'reviewed_at', v_request.reviewed_at
  );
end;
$$;

revoke all on function public.list_opportunity_applications_for_admin() from public, anon;
revoke all on function public.review_opportunity_application(uuid, text) from public, anon;
revoke all on function public.review_partner_request(uuid, text) from public, anon;
grant execute on function public.list_opportunity_applications_for_admin() to authenticated;
grant execute on function public.review_opportunity_application(uuid, text) to authenticated;
grant execute on function public.review_partner_request(uuid, text) to authenticated;

comment on function public.list_opportunity_applications_for_admin() is
  'Returns application review data to administrators with applications.read at AAL2.';
comment on function public.review_opportunity_application(uuid, text) is
  'Reviews an opportunity application using RBAC + AAL2 permission checks and writes an audit record.';
comment on function public.review_partner_request(uuid, text) is
  'Reviews a partner request, synchronizes the linked partner account status, and writes an audit record.';

commit;
