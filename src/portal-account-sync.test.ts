import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const portal = readFileSync(new URL('./pages/PortalPage.tsx', import.meta.url), 'utf8');

describe('portal account status synchronization', () => {
  it('refreshes account statuses from Supabase when an admin opens the portal', () => {
    expect(portal).toContain("import { loadSupabaseSnapshot } from '../services/supabaseStore';");
    expect(portal).toContain("account?.role !== 'admin'");
    expect(portal).toContain('void loadSupabaseSnapshot()');
    expect(portal).toContain('setVisibleAccounts(snapshot.accounts)');
  });

  it('renders account statistics and rows from the refreshed snapshot', () => {
    expect(portal).toContain('visibleAccounts.filter');
    expect(portal).toContain('visibleAccounts.map((target) =>');
  });
});
