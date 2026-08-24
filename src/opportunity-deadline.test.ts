import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../supabase/migrations/20260824140500_enforce_opportunity_application_deadlines.sql', import.meta.url),
  'utf8'
);
const page = readFileSync(new URL('./pages/OpportunitiesPage.tsx', import.meta.url), 'utf8');

describe('opportunity application deadlines', () => {
  it('blocks expired applications in database RLS', () => {
    expect(migration).toContain('o.deadline >= current_date');
    expect(migration).toContain("o.status in ('open', 'upcoming')");
    expect(migration).toContain("p.role = 'graduate'");
    expect(migration).toContain("p.status = 'active'");
  });

  it('disables Apply in the UI after the deadline', () => {
    expect(page).toContain('isOpportunityDeadlinePassed');
    expect(page).toContain("const applicationUnavailable = opportunity.status === 'Closed' || deadlinePassed");
    expect(page).toContain('disabled={applicationUnavailable}');
    expect(page).toContain("deadlinePassed: 'Prazo encerrado'");
  });
});
