drop policy if exists "Graduates can apply to opportunities" on public.opportunity_applications;

create policy "Graduates can apply to opportunities"
on public.opportunity_applications
for insert
to authenticated
with check (
  account_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'graduate'
      and p.status = 'active'
  )
  and exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_applications.opportunity_id
      and o.status in ('open', 'upcoming')
      and o.deadline >= current_date
  )
);
