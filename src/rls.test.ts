import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const audit = readFileSync(new URL('../supabase/audit.sql', import.meta.url), 'utf8');

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

  it('migrates timestamp columns required by triggers on existing tables', () => {
    expect(schema).toContain(
      'alter table public.profiles\n  add column if not exists updated_at'
    );
    expect(schema).toContain(
      'alter table public.opportunity_applications\n  add column if not exists updated_at'
    );
  });

  it('audits every required trigger and foreign-key connection', () => {
    expect(audit).toContain("'on_auth_user_created', 'public', 'handle_new_user'");
    expect(audit.match(/touch_[a-z_]+_updated_at/g)).toHaveLength(7);
    expect(audit).toContain(
      "('public.opportunity_applications', 'opportunity_id', 'public.opportunities', 'id', 'CASCADE')"
    );
    expect(audit).toContain(
      "('public.placements', 'partner_request_id', 'public.partner_requests', 'id', 'SET NULL')"
    );
  });
});
