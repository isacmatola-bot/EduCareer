import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../supabase/migrations/20260822072500_unify_graduate_registration_and_partner_opportunity_access.sql', import.meta.url),
  'utf8'
);
const hardeningMigration = readFileSync(
  new URL('../supabase/migrations/20260822075000_remove_anonymous_opportunity_privileges.sql', import.meta.url),
  'utf8'
);
const page = readFileSync(new URL('./pages/OpportunitiesPage.tsx', import.meta.url), 'utf8');
const store = readFileSync(new URL('./services/supabaseStore.ts', import.meta.url), 'utf8');
const types = readFileSync(new URL('./types.ts', import.meta.url), 'utf8');

describe('partner-owned member-only opportunities', () => {
  it('removes all anonymous opportunity privileges and requires an active account', () => {
    expect(migration).toContain('drop policy if exists "Public can read open opportunities"');
    expect(migration).toContain("p.status = 'active'");
    expect(hardeningMigration).toContain('revoke all privileges on table public.opportunities from anon');
    expect(page).toContain("memberAccess === 'restricted'");
    expect(page).toContain('available only to active EduCareer accounts');
  });

  it('records the publisher and restricts partner writes to owned rows', () => {
    expect(migration).toContain('add column if not exists created_by uuid references public.profiles(id)');
    expect(migration).toContain('"Active partners can insert own opportunities"');
    expect(migration).toContain('"Active partners can update own opportunities"');
    expect(migration).toContain('"Active partners can delete own opportunities"');
    expect(migration).toContain("p.role = 'partner'");
    expect(hardeningMigration).toContain('opportunities_created_by_idx');
    expect(store).toContain('created_by: userData.user.id');
    expect(types).toContain('createdBy?: string | null');
  });

  it('shows publishing controls to active partners but management controls only on their own rows', () => {
    expect(page).toContain("profile.role === 'partner'");
    expect(page).toContain("profile.status !== 'active'");
    expect(page).toContain('const canCreate = memberAccess === \'active\' && (canManage || Boolean(partnerPublisherId))');
    expect(page).toContain('opportunity.createdBy === partnerPublisherId');
    expect(page).toContain('const canManageItem = canManage || partnerOwnsOpportunity');
  });
});
