begin;

-- Member-only opportunities must have no table privileges available to the anonymous
-- API role. RLS already removes anonymous SELECT visibility; this revocation also
-- removes legacy REFERENCES/TRIGGER/TRUNCATE grants left by earlier broad grants.
revoke all privileges on table public.opportunities from anon;

-- Ownership is part of the Partner write predicate, so index it for RLS and owner
-- management lookups as Partner-published opportunity volume grows.
create index if not exists opportunities_created_by_idx
  on public.opportunities(created_by)
  where created_by is not null;

comment on index public.opportunities_created_by_idx is
  'Supports Partner-owned opportunity RLS and owner-scoped management queries.';

commit;
