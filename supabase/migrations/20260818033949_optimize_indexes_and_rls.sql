-- Cover foreign keys used by joins/RLS and remove a duplicate uniqueness
-- constraint left by the legacy profile migration.

create index if not exists candidates_account_id_idx
  on public.candidates (account_id);
create index if not exists partner_requests_account_id_idx
  on public.partner_requests (account_id);
create index if not exists opportunity_applications_account_id_idx
  on public.opportunity_applications (account_id);
create index if not exists placements_candidate_id_idx
  on public.placements (candidate_id);
create index if not exists placements_opportunity_id_idx
  on public.placements (opportunity_id);
create index if not exists placements_partner_request_id_idx
  on public.placements (partner_request_id);

create index if not exists legacy_applications_company_id_idx
  on legacy.applications (company_id);
create index if not exists legacy_applications_student_id_idx
  on legacy.applications (student_id);
create index if not exists legacy_registrations_event_id_idx
  on legacy.registrations (event_id);
create index if not exists legacy_registrations_workshop_id_idx
  on legacy.registrations (workshop_id);
create index if not exists legacy_students_profile_id_idx
  on legacy.students (profile_id);

alter table public.profiles
  drop constraint if exists profiles_email_unique;

-- Cache identity/helper calls once per statement instead of once per row.
drop policy if exists "Profiles are visible to owner and admins" on public.profiles;
create policy "Profiles are visible to owner and admins"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.current_user_is_admin())
);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles for insert to authenticated
with check (
  id = (select auth.uid())
  and role in ('graduate', 'partner')
  and admin_role is null
  and status = 'pending'
);

drop policy if exists "Graduates can create candidate applications" on public.candidates;
create policy "Graduates can create candidate applications"
on public.candidates for insert to authenticated
with check (account_id = (select auth.uid()));

drop policy if exists "Candidates are visible to owner and admins" on public.candidates;
create policy "Candidates are visible to owner and admins"
on public.candidates for select to authenticated
using (
  account_id = (select auth.uid())
  or (select private.current_user_is_admin())
);

drop policy if exists "Authorized admins can update candidate status" on public.candidates;
create policy "Authorized admins can update candidate status"
on public.candidates for update to authenticated
using ((select private.current_user_has_permission('candidates.manage')))
with check ((select private.current_user_has_permission('candidates.manage')));

drop policy if exists "Partners can create partner requests" on public.partner_requests;
create policy "Partners can create partner requests"
on public.partner_requests for insert to authenticated
with check (account_id = (select auth.uid()));

drop policy if exists "Partner requests are visible to owner and admins" on public.partner_requests;
create policy "Partner requests are visible to owner and admins"
on public.partner_requests for select to authenticated
using (
  account_id = (select auth.uid())
  or (select private.current_user_is_admin())
);

drop policy if exists "Authorized admins can update partner requests" on public.partner_requests;
create policy "Authorized admins can update partner requests"
on public.partner_requests for update to authenticated
using ((select private.current_user_has_permission('partner_requests.manage')))
with check ((select private.current_user_has_permission('partner_requests.manage')));

-- Keep exactly one SELECT policy per database role. Management permissions use
-- command-specific policies so they do not create duplicate SELECT policies.
drop policy if exists "Public can read open opportunities" on public.opportunities;
drop policy if exists "Admins can read all opportunities" on public.opportunities;
drop policy if exists "Authorized admins can manage opportunities" on public.opportunities;

create policy "Public can read open opportunities"
on public.opportunities for select to anon
using (status in ('open', 'upcoming'));

create policy "Authenticated users can read permitted opportunities"
on public.opportunities for select to authenticated
using (
  status in ('open', 'upcoming')
  or (select private.current_user_is_admin())
);

create policy "Authorized admins can insert opportunities"
on public.opportunities for insert to authenticated
with check ((select private.current_user_has_permission('opportunities.manage')));
create policy "Authorized admins can update opportunities"
on public.opportunities for update to authenticated
using ((select private.current_user_has_permission('opportunities.manage')))
with check ((select private.current_user_has_permission('opportunities.manage')));
create policy "Authorized admins can delete opportunities"
on public.opportunities for delete to authenticated
using ((select private.current_user_has_permission('opportunities.manage')));

drop policy if exists "Public can read published programs" on public.programs;
drop policy if exists "Admins can read all programs" on public.programs;
drop policy if exists "Authorized admins can manage programs" on public.programs;

create policy "Public can read published programs"
on public.programs for select to anon
using (status = 'published');

create policy "Authenticated users can read permitted programs"
on public.programs for select to authenticated
using (
  status = 'published'
  or (select private.current_user_is_admin())
);

create policy "Authorized admins can insert programs"
on public.programs for insert to authenticated
with check ((select private.current_user_has_permission('programs.manage')));
create policy "Authorized admins can update programs"
on public.programs for update to authenticated
using ((select private.current_user_has_permission('programs.manage')))
with check ((select private.current_user_has_permission('programs.manage')));
create policy "Authorized admins can delete programs"
on public.programs for delete to authenticated
using ((select private.current_user_has_permission('programs.manage')));

drop policy if exists "Graduates can apply to opportunities" on public.opportunity_applications;
create policy "Graduates can apply to opportunities"
on public.opportunity_applications for insert to authenticated
with check (
  account_id = (select auth.uid())
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'graduate' and status = 'active'
  )
  and exists (
    select 1 from public.opportunities
    where id = opportunity_id and status in ('open', 'upcoming')
  )
);

drop policy if exists "Applications are visible to owner and admins" on public.opportunity_applications;
create policy "Applications are visible to owner and admins"
on public.opportunity_applications for select to authenticated
using (
  account_id = (select auth.uid())
  or (select private.current_user_is_admin())
);

drop policy if exists "Authorized admins can update applications" on public.opportunity_applications;
create policy "Authorized admins can update applications"
on public.opportunity_applications for update to authenticated
using ((select private.current_user_has_permission('applications.manage')))
with check ((select private.current_user_has_permission('applications.manage')));

drop policy if exists "Admins can read placements" on public.placements;
drop policy if exists "Authorized admins can manage placements" on public.placements;
create policy "Admins can read placements"
on public.placements for select to authenticated
using ((select private.current_user_is_admin()));
create policy "Authorized admins can insert placements"
on public.placements for insert to authenticated
with check ((select private.current_user_has_permission('placements.manage')));
create policy "Authorized admins can update placements"
on public.placements for update to authenticated
using ((select private.current_user_has_permission('placements.manage')))
with check ((select private.current_user_has_permission('placements.manage')));
create policy "Authorized admins can delete placements"
on public.placements for delete to authenticated
using ((select private.current_user_has_permission('placements.manage')));

drop policy if exists "Executives can read administrative audit logs" on public.admin_audit_log;
create policy "Executives can read administrative audit logs"
on public.admin_audit_log for select to authenticated
using ((select private.current_user_has_permission('audit.read')));
