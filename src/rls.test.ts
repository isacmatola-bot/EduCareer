import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const audit = readFileSync(new URL('../supabase/audit.sql', import.meta.url), 'utf8');
const accountOperations = readFileSync(
  new URL('../supabase/migrations/20260816010224_account_operations.sql', import.meta.url),
  'utf8'
);
const publicAdminRlsSeparation = readFileSync(
  new URL('../supabase/migrations/20260816010301_separate_public_and_admin_rls.sql', import.meta.url),
  'utf8'
);
const permissionMatrix = readFileSync(
  new URL('../supabase/migrations/20260818_install_admin_permission_matrix.sql', import.meta.url),
  'utf8'
);
const mandatoryMfa = readFileSync(
  new URL('../supabase/migrations/20260818_require_mfa_for_privileged_admins.sql', import.meta.url),
  'utf8'
);

describe('Supabase authorization contract', () => {
  it('installs a canonical, private role-permission matrix', () => {
    expect(permissionMatrix).toContain('private.admin_role_permissions');
    expect(permissionMatrix).toContain('private.current_user_has_permission');
    expect(permissionMatrix).toContain("'support', 'accounts.maintain'");
    expect(permissionMatrix).toContain("'programs', 'programs.manage'");
  });

  it('routes profile mutations through field-aware Edge Functions', () => {
    expect(permissionMatrix).toContain(
      'drop policy if exists "Operational admins can update permitted profiles"'
    );
    expect(permissionMatrix).toContain('revoke update on table public.profiles from authenticated');
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

  it('reconnects legacy profiles to Supabase Auth', () => {
    expect(schema).toContain(
      "foreign key (id) references auth.users(id) on delete cascade"
    );
    expect(schema).toContain(
      "confrelid = 'auth.users'::regclass"
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
    expect(audit).toContain("when not actual.convalidated then 'NOT_VALIDATED'");
  });

  it('supports rejected accounts and verified email synchronization', () => {
    expect(schema).toContain("status in ('active', 'pending', 'rejected', 'disabled')");
    expect(accountOperations).toContain('on_auth_user_email_changed');
    expect(accountOperations).toContain('sync_profile_email_from_auth');
    expect(accountOperations).toContain(
      'revoke all on function public.sync_profile_email_from_auth() from public, anon, authenticated'
    );
  });

  it('separates public reads from authenticated administrative authorization', () => {
    expect(publicAdminRlsSeparation).toContain("using (status in ('open', 'upcoming'))");
    expect(publicAdminRlsSeparation).toContain("using (status = 'published')");
    expect(publicAdminRlsSeparation).toContain(
      'revoke all on function public.current_user_can_manage_operations()\nfrom public, anon'
    );
    expect(publicAdminRlsSeparation).toContain(
      'grant execute on function public.current_user_can_manage_operations()\nto authenticated'
    );
    expect(publicAdminRlsSeparation).not.toContain(
      'grant execute on function public.current_user_can_manage_operations()\nto anon, authenticated'
    );
  });

  it('separates departmental writes from collective admin read access', () => {
    expect(permissionMatrix).toContain("private.current_user_has_permission('programs.manage')");
    expect(permissionMatrix).toContain("private.current_user_has_permission('opportunities.manage')");
    expect(permissionMatrix).toContain("private.current_user_has_permission('partner_requests.manage')");
    expect(permissionMatrix).toContain('create policy "Admins can read all programs"');
    expect(permissionMatrix).toContain('create policy "Admins can read all opportunities"');
  });

  it('records privileged account operations in an immutable audit table', () => {
    expect(permissionMatrix).toContain('create table if not exists public.admin_audit_log');
    expect(permissionMatrix).toContain('revoke all on table public.admin_audit_log');
    expect(permissionMatrix).toContain("private.current_user_has_permission('audit.read')");
  });

  it('requires an AAL2 session for privileged administrator permissions', () => {
    expect(mandatoryMfa).toContain("auth.jwt() ->> 'aal'");
    expect(mandatoryMfa).toContain("'default_admin', 'ceo', 'director', 'it', 'support'");
    expect(mandatoryMfa).toContain("= 'aal2'");
  });
});
