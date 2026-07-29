begin;

-- Public read policies for programs and opportunities reference this
-- SECURITY DEFINER helper. The anon role must be able to evaluate it; the
-- function only returns a boolean based on auth.uid() and exposes no rows.
revoke all on function public.current_user_can_manage_operations() from public;
grant execute on function public.current_user_can_manage_operations()
to anon, authenticated;

commit;
