-- EduCareer Supabase schema for future database integration.
-- Run this SQL in Supabase SQL Editor when you are ready to replace local demo storage.

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
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
  created_at timestamptz not null default now()
);

create table if not exists public.partner_requests (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  contact_person text not null,
  email text not null,
  phone text not null,
  organization_type text not null,
  support_needed text not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'approved', 'rejected')),
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
);

alter table public.candidates enable row level security;
alter table public.partner_requests enable row level security;
alter table public.opportunities enable row level security;
alter table public.placements enable row level security;

-- Development/demo policies. Tighten these before production.
create policy "Allow public candidate registration" on public.candidates
  for insert to anon with check (true);

create policy "Allow public partner registration" on public.partner_requests
  for insert to anon with check (true);

create policy "Allow public opportunity reading" on public.opportunities
  for select to anon using (true);
