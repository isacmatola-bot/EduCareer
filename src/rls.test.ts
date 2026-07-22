import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

describe('Supabase authorization contract', () => {
  it('recognizes the four operational administrator roles', () => {
    expect(schema).toContain("admin_role in ('default_admin', 'ceo', 'director', 'it')");
  });

  it('allows operational admins to update non-admin profiles only', () => {
    expect(schema).toContain('Operational admins can update permitted profiles');
    expect(schema).toContain("public.current_user_is_default_admin() or role <> 'admin'");
  });

  it('forces Auth-aware profile deletion through the server function', () => {
    expect(schema).toContain('revoke update, delete on public.profiles from authenticated');
    expect(schema).not.toContain('create policy "Default admin can delete profiles"');
  });

  it('removes legacy self-approval and public profile policies', () => {
    expect(schema).toContain('drop policy if exists "Users can update own profile"');
    expect(schema).toContain('drop policy if exists "Public can resolve login usernames"');
    expect(schema).toContain('drop policy if exists "Allow candidates update"');
  });
});
