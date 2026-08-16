begin;

-- Public read policies must not invoke privileged authorization helpers.
-- Administrative visibility is already provided by the authenticated-only
-- management policies on these tables.
drop policy if exists "Public can read open opportunities"
on public.opportunities;

create policy "Public can read open opportunities"
on public.opportunities
for select
to anon, authenticated
using (status in ('open', 'upcoming'));

drop policy if exists "Public can read published programs"
on public.programs;

create policy "Public can read published programs"
on public.programs
for select
to anon, authenticated
using (status = 'published');

-- Keep the SECURITY DEFINER helper available only to signed-in users whose
-- RLS policies require it. It must not be exposed to anon or PUBLIC.
revoke all on function public.current_user_can_manage_operations()
from public, anon;

grant execute on function public.current_user_can_manage_operations()
to authenticated;

commit;
