import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync(new URL('./features/admin/DashboardPage.tsx', import.meta.url), 'utf8');
const portal = readFileSync(new URL('./pages/PortalPage.tsx', import.meta.url), 'utf8');

describe('cross-admin realtime synchronization', () => {
  it('reloads operational queues when authorized workflow rows change', () => {
    expect(dashboard).toContain("table: 'candidates'");
    expect(dashboard).toContain("table: 'opportunity_applications'");
    expect(dashboard).toContain("table: 'partner_requests'");
    expect(dashboard).toContain('() => void loadWorkflow()');
    expect(dashboard).toContain('client.removeChannel(channel)');
  });

  it('reloads account management when profile status changes in another admin session', () => {
    expect(portal).toContain("table: 'profiles'");
    expect(portal).toContain('refreshAccounts');
    expect(portal).toContain('loadSupabaseSnapshot()');
    expect(portal).toContain('client.removeChannel(channel)');
  });
});
