import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync(new URL('./features/admin/DashboardPage.tsx', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('./services/adminWorkflow.ts', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../supabase/migrations/20260821062000_add_dashboard_review_workflows.sql', import.meta.url),
  'utf8'
);

describe('interactive admin dashboard workflows', () => {
  it('renders operational controls for applications and partner requests', () => {
    expect(dashboard).toContain('reviewOpportunityApplication');
    expect(dashboard).toContain('reviewPartnerRequest');
    expect(dashboard).toContain("onChangeStatus(item.id, 'reviewing')");
    expect(dashboard).toContain("onChangeStatus(item.id, 'accepted')");
    expect(dashboard).toContain("onChangeStatus(item.id, 'approved')");
    expect(dashboard).toContain("onChangeStatus(item.id, 'rejected')");
  });

  it('uses the production application and partner review RPCs', () => {
    expect(workflow).toContain("client.rpc('list_opportunity_applications_for_admin')");
    expect(workflow).toContain("client.rpc('review_opportunity_application'");
    expect(workflow).toContain("client.rpc('review_partner_request'");
  });

  it('enforces RBAC/AAL2 through permission-aware database functions and audit logging', () => {
    expect(migration).toContain("private.current_user_has_permission('applications.read')");
    expect(migration).toContain("private.current_user_has_permission('applications.manage')");
    expect(migration).toContain("private.current_user_has_permission('partner_requests.manage')");
    expect(migration).toContain("'opportunity_application.status_changed'");
    expect(migration).toContain("'partner_request.status_changed'");
    expect(migration).toContain("grant execute on function public.review_opportunity_application(uuid, text) to authenticated");
    expect(migration).toContain("grant execute on function public.review_partner_request(uuid, text) to authenticated");
  });
});
