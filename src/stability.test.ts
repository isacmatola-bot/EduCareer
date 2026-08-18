import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scrubClientValue } from '../api/client-error';

describe('stability baseline', () => {
  it('pins Node 24 in local, package and CI configuration', () => {
    expect(readFileSync('.nvmrc', 'utf8').trim()).toBe('24');
    expect(JSON.parse(readFileSync('package.json', 'utf8')).engines.node).toBe('24.x');
    expect(readFileSync('.github/workflows/ci.yml', 'utf8')).toContain('node-version: 24.x');
  });

  it('contains the RLS init-plan and foreign-key index repairs', () => {
    const migration = readFileSync('supabase/migrations/20260818_optimize_indexes_and_rls.sql', 'utf8');
    expect(migration).toContain('(select auth.uid())');
    expect(migration).toContain('candidates_account_id_idx');
    expect(migration).toContain('legacy_students_profile_id_idx');
    expect(migration).toContain('drop constraint if exists profiles_email_unique');
  });

  it('redacts personal and authentication data from telemetry', () => {
    expect(scrubClientValue('Failed for user@example.com', 100)).toBe('Failed for [email]');
    expect(scrubClientValue('eyJabc.def.ghi', 100)).toBe('[token]');
  });
});
