import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../supabase/migrations/20260822072500_unify_graduate_registration_and_partner_opportunity_access.sql', import.meta.url),
  'utf8'
);
const workflow = readFileSync(new URL('./services/adminWorkflow.ts', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('./features/admin/DashboardPage.tsx', import.meta.url), 'utf8');
const store = readFileSync(new URL('./services/supabaseStore.ts', import.meta.url), 'utf8');
const portal = readFileSync(new URL('./pages/PortalPage.tsx', import.meta.url), 'utf8');

describe('canonical graduate registration workflow', () => {
  it('keeps account approval separate from later graduate/application data', () => {
    expect(migration).toContain("add column if not exists registration_status text not null default 'submitted'");
    expect(migration).toContain("check (registration_status in ('submitted', 'reviewing', 'approved', 'rejected'))");
    expect(migration).toContain('registration_reviewed_by');
    expect(migration).toContain('registration_reviewed_at');
  });

  it('enforces submitted -> reviewing -> approved/rejected through RBAC and audit logging', () => {
    expect(migration).toContain("private.current_user_has_permission('candidates.manage')");
    expect(migration).toContain("v_candidate.registration_status = 'submitted' and p_status <> 'reviewing'");
    expect(migration).toContain("v_candidate.registration_status = 'reviewing' and p_status not in ('approved', 'rejected')");
    expect(migration).toContain("'graduate_registration.status_changed'");
    expect(migration).toContain('sync_graduate_registration_from_profile_status');
    expect(migration).toContain('sync_graduate_profile_from_registration_status');
  });

  it('uses the same RPC workflow from Dashboard and Manage Profiles', () => {
    expect(workflow).toContain("client.rpc('list_graduate_registrations_for_admin')");
    expect(workflow).toContain("client.rpc('review_graduate_registration'");
    expect(dashboard).toContain('reviewGraduateRegistration');
    expect(dashboard).toContain("table: 'candidates'");
    expect(store).toContain("role === 'graduate' ? 'review_graduate_registration' : 'review_partner_request'");
    expect(store).toContain('advanceRegistrationWorkflow');
    expect(portal).toContain("hasAdminPermission(account, 'candidates.manage')");
  });
});
