begin;

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

  if v_application.status = 'submitted' and p_status <> 'reviewing' then
    raise exception 'Submitted applications must enter reviewing before a final decision.' using errcode = '22023';
  end if;

  if v_application.status = 'reviewing' and p_status not in ('accepted', 'rejected') then
    raise exception 'Applications under review must be accepted or rejected.' using errcode = '22023';
  end if;

  if v_application.status in ('accepted', 'rejected', 'withdrawn') then
    raise exception 'This application is already in a terminal state.' using errcode = '22023';
  end if;

  if v_application.status not in ('submitted', 'reviewing') then
    raise exception 'Unsupported current application status.' using errcode = '22023';
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

  if v_request.status = 'submitted' and p_status <> 'reviewing' then
    raise exception 'Submitted partner requests must enter reviewing before a final decision.' using errcode = '22023';
  end if;

  if v_request.status = 'reviewing' and p_status not in ('approved', 'rejected') then
    raise exception 'Partner requests under review must be approved or rejected.' using errcode = '22023';
  end if;

  if v_request.status in ('approved', 'rejected') then
    raise exception 'This partner request is already in a terminal state.' using errcode = '22023';
  end if;

  if v_request.status not in ('submitted', 'reviewing') then
    raise exception 'Unsupported current partner request status.' using errcode = '22023';
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

revoke all on function public.review_opportunity_application(uuid, text) from public, anon;
revoke all on function public.review_partner_request(uuid, text) from public, anon;
grant execute on function public.review_opportunity_application(uuid, text) to authenticated;
grant execute on function public.review_partner_request(uuid, text) to authenticated;

comment on function public.review_opportunity_application(uuid, text) is
  'Reviews an opportunity application using a strict submitted -> reviewing -> accepted/rejected state machine, RBAC + AAL2 checks, and audit logging.';
comment on function public.review_partner_request(uuid, text) is
  'Reviews a partner request using a strict submitted -> reviewing -> approved/rejected state machine, synchronizes the linked account, and writes an audit record.';

commit;
