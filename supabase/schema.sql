-- EduCareer Supabase schema.
-- Run this SQL in the Supabase SQL Editor before enabling the frontend
-- VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY variables.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null unique,
  display_name text not null,
  phone text,
  role text not null check (role in ('graduate', 'partner', 'admin')),
  admin_role text check (
    admin_role is null or admin_role in (
      'default_admin',
      'ceo',
      'director',
      'it',
      'rh',
      'finance',
      'programs',
      'opportunities',
      'partnerships',
      'support',
      'statistics'
    )
  ),
  status text not null default 'pending' check (status in ('active', 'pending', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.profiles(id) on delete set null,
  username text,
  full_name text not null,
  email text not null,
  phone text not null,
  province text not null default 'Sofala',
  institution text not null,
  qualification text not null,
  teaching_area text not null,
  preferred_program text not null,
  motivation text not null,
  status text not null default 'new' check (status in ('new', 'shortlisted', 'placed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.profiles(id) on delete set null,
  username text,
  organization_name text not null,
  contact_person text not null,
  email text not null,
  phone text not null,
  organization_type text not null,
  support_needed text not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.programs (
  id text primary key,
  name text not null,
  tagline text not null default '',
  description text not null,
  activities text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  institution text not null,
  location text not null,
  opportunity_type text not null,
  deadline date not null,
  status text not null default 'open' check (status in ('open', 'upcoming', 'closed')),
  requirements text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunity_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  account_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, account_id)
);

create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  partner_request_id uuid references public.partner_requests(id) on delete set null,
  placement_type text not null,
  start_date date,
  end_date date,
  supervisor_name text,
  feedback text,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_candidates_updated_at on public.candidates;
create trigger touch_candidates_updated_at
before update on public.candidates
for each row execute function public.touch_updated_at();

drop trigger if exists touch_partner_requests_updated_at on public.partner_requests;
create trigger touch_partner_requests_updated_at
before update on public.partner_requests
for each row execute function public.touch_updated_at();

drop trigger if exists touch_programs_updated_at on public.programs;
create trigger touch_programs_updated_at
before update on public.programs
for each row execute function public.touch_updated_at();

drop trigger if exists touch_opportunities_updated_at on public.opportunities;
create trigger touch_opportunities_updated_at
before update on public.opportunities
for each row execute function public.touch_updated_at();

drop trigger if exists touch_opportunity_applications_updated_at on public.opportunity_applications;
create trigger touch_opportunity_applications_updated_at
before update on public.opportunity_applications
for each row execute function public.touch_updated_at();

drop trigger if exists touch_placements_updated_at on public.placements;
create trigger touch_placements_updated_at
before update on public.placements
for each row execute function public.touch_updated_at();

create or replace function public.current_user_is_default_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and admin_role = 'default_admin'
      and status = 'active'
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

create or replace function public.current_user_can_manage_operations()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and admin_role in ('default_admin', 'ceo', 'director', 'it')
      and status = 'active'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'graduate');
  requested_admin_role text := new.raw_user_meta_data ->> 'admin_role';
  create_registration_record boolean;
begin
  if requested_role not in ('graduate', 'partner', 'admin') then
    requested_role := 'graduate';
  end if;

  create_registration_record := requested_role in ('graduate', 'partner');

  if requested_role = 'admin' then
    requested_role := 'graduate';
  end if;
  requested_admin_role := null;

  insert into public.profiles (
    id,
    username,
    email,
    display_name,
    phone,
    role,
    admin_role,
    status
  )
  values (
    new.id,
    lower(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1))),
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    requested_role,
    requested_admin_role,
    case when requested_role = 'admin' then 'active' else 'pending' end
  )
  on conflict (id) do update set
    email = excluded.email,
    username = excluded.username,
    display_name = excluded.display_name,
    phone = excluded.phone,
    role = excluded.role,
    admin_role = excluded.admin_role,
    status = excluded.status,
    updated_at = now();

  if create_registration_record and requested_role = 'graduate' and not exists (
    select 1 from public.candidates where account_id = new.id
  ) then
    insert into public.candidates (
      account_id,
      username,
      full_name,
      email,
      phone,
      province,
      institution,
      qualification,
      teaching_area,
      preferred_program,
      motivation
    ) values (
      new.id,
      lower(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1))),
      coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
      new.email,
      coalesce(new.raw_user_meta_data ->> 'phone', ''),
      coalesce(nullif(new.raw_user_meta_data ->> 'province', ''), 'Sofala'),
      coalesce(new.raw_user_meta_data ->> 'institution', ''),
      coalesce(new.raw_user_meta_data ->> 'qualification', ''),
      coalesce(new.raw_user_meta_data ->> 'teaching_area', ''),
      coalesce(new.raw_user_meta_data ->> 'preferred_program', ''),
      coalesce(new.raw_user_meta_data ->> 'motivation', '')
    );
  end if;

  if create_registration_record and requested_role = 'partner' and not exists (
    select 1 from public.partner_requests where account_id = new.id
  ) then
    insert into public.partner_requests (
      account_id,
      username,
      organization_name,
      contact_person,
      email,
      phone,
      organization_type,
      support_needed
    ) values (
      new.id,
      lower(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1))),
      coalesce(nullif(new.raw_user_meta_data ->> 'organization_name', ''), nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
      coalesce(new.raw_user_meta_data ->> 'contact_person', ''),
      new.email,
      coalesce(new.raw_user_meta_data ->> 'phone', ''),
      coalesce(new.raw_user_meta_data ->> 'organization_type', ''),
      coalesce(new.raw_user_meta_data ->> 'support_needed', '')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.get_login_email(login_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where username = lower(trim(login_username))
    and status <> 'disabled'
  limit 1;
$$;

insert into public.programs (id, name, tagline, description, activities, status) values
  ('edulink', 'EduLink – Career Connection Platform', 'Connecting qualified educators to real opportunities.', 'A digital bridge between teacher trainees, postgraduate students, schools, and education employers.', array['Candidate profile registration and readiness screening.', 'Publication of school vacancies and teaching opportunities.', 'Matching of graduates to schools based on subject area, location, and availability.', 'Follow-up records for placements and employment outcomes.'], 'published'),
  ('teachready', 'TeachReady Internship Program', 'Practical classroom exposure before full employment.', 'Structured placements for assistant teachers, reinforcement class teachers, and practice teachers in public and private schools.', array['School placement coordination.', 'Internship attendance and supervisor tracking.', 'Classroom support for schools with high student–teacher ratios.', 'Performance feedback reports for trainees.'], 'published'),
  ('edumentor', 'EduMentor Network', 'Guidance from experienced educators.', 'A mentorship network connecting early-career educators with professionals who can guide their transition into the labour market.', array['Mentor and mentee registration.', 'Monthly mentoring sessions.', 'Career planning support.', 'Professional ethics and classroom confidence coaching.'], 'published'),
  ('seminars', 'Professional Growth Seminars', 'Skills for employability and better teaching practice.', 'Workshops and seminars focused on classroom management, digital pedagogy, job readiness, and education leadership.', array['Classroom management workshops.', 'Digital pedagogy training.', 'CV, interview, and professional readiness sessions.', 'Education labour market seminars.'], 'published')
on conflict (id) do nothing;

insert into public.opportunities (id, title, institution, location, opportunity_type, deadline, status, requirements) values
  ('10000000-0000-4000-8000-000000000001', 'Assistant Teacher Placement – Primary Education', 'Partner Public School Network', 'Beira, Sofala', 'Assistant Teacher', '2026-08-15', 'open', array['Teacher training background', 'Availability for classroom support', 'Strong communication skills']),
  ('10000000-0000-4000-8000-000000000002', 'TeachReady Internship – Secondary Education', 'EduCareer Placement Desk', 'Sofala Province', 'Internship', '2026-09-01', 'upcoming', array['Postgraduate or final-year trainee', 'Subject specialization', 'Commitment to school-based practice']),
  ('10000000-0000-4000-8000-000000000003', 'EduMentor Monthly Cohort', 'EduMentor Network', 'Hybrid', 'Mentorship', '2026-07-30', 'open', array['New graduate or trainee teacher', 'Clear career development goals', 'Willingness to attend mentoring sessions']),
  ('10000000-0000-4000-8000-000000000004', 'Digital Pedagogy Seminar', 'Professional Growth Seminars', 'Beira, Sofala', 'Seminar', '2026-08-05', 'open', array['Interest in digital teaching tools', 'Basic computer literacy', 'Teaching or training background'])
on conflict (id) do nothing;

grant usage on schema public to anon, authenticated;
grant select on public.programs, public.opportunities to anon, authenticated;
grant insert, update, delete on public.programs, public.opportunities to authenticated;
grant select, insert, update on public.opportunity_applications to authenticated;
revoke update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, phone, status) on public.profiles to authenticated;

alter table public.profiles enable row level security;
alter table public.candidates enable row level security;
alter table public.partner_requests enable row level security;
alter table public.programs enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_applications enable row level security;
alter table public.placements enable row level security;

-- Remove policies left by earlier EduCareer schema versions. Keeping these
-- alongside the current policies can broaden access (for example, allowing a
-- pending user to update their own status and approve their account).
drop policy if exists "Authenticated user can update own profile" on public.profiles;
drop policy if exists "Authenticated users can read profiles" on public.profiles;
drop policy if exists "Public can lookup admin login profile" on public.profiles;
drop policy if exists "Public can resolve login usernames" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Allow candidate registration" on public.candidates;
drop policy if exists "Allow candidates read" on public.candidates;
drop policy if exists "Allow candidates update" on public.candidates;
drop policy if exists "Authenticated users can create candidate applications" on public.candidates;
drop policy if exists "Authenticated users can create partner requests" on public.partner_requests;

drop policy if exists "Profiles are visible to owner and admins" on public.profiles;
create policy "Profiles are visible to owner and admins" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles
  for insert to authenticated
  with check (
    id = auth.uid()
    and role in ('graduate', 'partner')
    and admin_role is null
    and status = 'pending'
  );

drop policy if exists "Default admin can update profiles" on public.profiles;
drop policy if exists "Operational admins can update permitted profiles" on public.profiles;
create policy "Operational admins can update permitted profiles" on public.profiles
  for update to authenticated
  using (
    public.current_user_can_manage_operations()
    and (public.current_user_is_default_admin() or role <> 'admin')
  )
  with check (
    public.current_user_can_manage_operations()
    and (public.current_user_is_default_admin() or role <> 'admin')
  );

drop policy if exists "Default admin can delete profiles" on public.profiles;

drop policy if exists "Graduates can create candidate applications" on public.candidates;
create policy "Graduates can create candidate applications" on public.candidates
  for insert to authenticated
  with check (account_id = auth.uid());

drop policy if exists "Candidates are visible to owner and admins" on public.candidates;
create policy "Candidates are visible to owner and admins" on public.candidates
  for select to authenticated
  using (account_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Admins can update candidate status" on public.candidates;
create policy "Admins can update candidate status" on public.candidates
  for update to authenticated
  using (public.current_user_can_manage_operations())
  with check (public.current_user_can_manage_operations());

drop policy if exists "Partners can create partner requests" on public.partner_requests;
create policy "Partners can create partner requests" on public.partner_requests
  for insert to authenticated
  with check (account_id = auth.uid());

drop policy if exists "Partner requests are visible to owner and admins" on public.partner_requests;
create policy "Partner requests are visible to owner and admins" on public.partner_requests
  for select to authenticated
  using (account_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Admins can update partner request status" on public.partner_requests;
create policy "Admins can update partner request status" on public.partner_requests
  for update to authenticated
  using (public.current_user_can_manage_operations())
  with check (public.current_user_can_manage_operations());

drop policy if exists "Public can read open opportunities" on public.opportunities;
create policy "Public can read open opportunities" on public.opportunities
  for select to anon, authenticated
  using (status in ('open', 'upcoming') or public.current_user_can_manage_operations());

drop policy if exists "Admins can manage opportunities" on public.opportunities;
create policy "Admins can manage opportunities" on public.opportunities
  for all to authenticated
  using (public.current_user_can_manage_operations())
  with check (public.current_user_can_manage_operations());

drop policy if exists "Public can read published programs" on public.programs;
create policy "Public can read published programs" on public.programs
  for select to anon, authenticated
  using (status = 'published' or public.current_user_can_manage_operations());

drop policy if exists "Operational admins can manage programs" on public.programs;
create policy "Operational admins can manage programs" on public.programs
  for all to authenticated
  using (public.current_user_can_manage_operations())
  with check (public.current_user_can_manage_operations());

drop policy if exists "Graduates can apply to opportunities" on public.opportunity_applications;
create policy "Graduates can apply to opportunities" on public.opportunity_applications
  for insert to authenticated
  with check (
    account_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'graduate' and status = 'active'
    )
    and exists (
      select 1 from public.opportunities
      where id = opportunity_id and status in ('open', 'upcoming')
    )
  );

drop policy if exists "Applications are visible to owner and operational admins" on public.opportunity_applications;
create policy "Applications are visible to owner and operational admins" on public.opportunity_applications
  for select to authenticated
  using (account_id = auth.uid() or public.current_user_can_manage_operations());

drop policy if exists "Operational admins can update applications" on public.opportunity_applications;
create policy "Operational admins can update applications" on public.opportunity_applications
  for update to authenticated
  using (public.current_user_can_manage_operations())
  with check (public.current_user_can_manage_operations());

drop policy if exists "Admins can manage placements" on public.placements;
create policy "Admins can manage placements" on public.placements
  for all to authenticated
  using (public.current_user_can_manage_operations())
  with check (public.current_user_can_manage_operations());

-- Default admin bootstrapping:
-- 1. Create the first user in Supabase Auth using the dashboard.
-- 2. Then run:
-- update public.profiles
-- set role = 'admin', admin_role = 'default_admin', status = 'active'
-- where email = 'admin@your-domain.com';
--
-- After that, deploy the optional `admin-create-user` Edge Function so the
-- default admin can create CEO, Director, IT, RH, Finance, Programs, and
-- other administrative accounts without exposing a service role key.
