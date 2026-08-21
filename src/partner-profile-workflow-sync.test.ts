import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../supabase/migrations/20260822071000_sync_partner_profile_and_request_status.sql', import.meta.url),
  'utf8'
);

describe('partner account and request state synchronization', () => {
  it('synchronizes final partner decisions in both directions', () => {
    expect(migration).toContain('sync_partner_request_from_profile_status');
    expect(migration).toContain('sync_partner_profile_from_request_status');
    expect(migration).toContain("when 'active' then 'approved'");
    expect(migration).toContain("when 'approved' then 'active'");
    expect(migration).toContain("when 'rejected' then 'rejected'");
  });

  it('protects terminal partner registration decisions from contradictory profile changes', () => {
    expect(migration).toContain('A rejected partner registration cannot be activated');
    expect(migration).toContain('An approved partner registration cannot be rejected');
    expect(migration).toContain('A final partner registration decision cannot be reverted to pending');
  });

  it('repairs existing mismatches and enables realtime publication for admin workflow tables', () => {
    expect(migration).toContain("p.updated_at > pr.updated_at");
    expect(migration).toContain("tablename = 'profiles'");
    expect(migration).toContain("tablename = 'partner_requests'");
    expect(migration).toContain("tablename = 'opportunity_applications'");
    expect(migration).toContain('alter publication supabase_realtime add table public.profiles');
  });
});
