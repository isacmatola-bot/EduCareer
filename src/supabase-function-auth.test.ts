import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const clientSource = readFileSync(new URL('./services/supabaseClient.ts', import.meta.url), 'utf8');
const manageSource = readFileSync(
  new URL('../supabase/functions/admin-manage-user/index.ts', import.meta.url),
  'utf8'
);
const createSource = readFileSync(
  new URL('../supabase/functions/admin-create-user/index.ts', import.meta.url),
  'utf8'
);
const selfServiceSource = readFileSync(
  new URL('../supabase/functions/account-self-service/index.ts', import.meta.url),
  'utf8'
);

const privilegedFunctionSources = [manageSource, createSource, selfServiceSource];

describe('Supabase Edge Function auth synchronization', () => {
  it('keeps the Functions authorization header aligned with Auth session changes', () => {
    expect(clientSource).toContain('configuredSupabase.auth.onAuthStateChange');
    expect(clientSource).toContain('configuredSupabase.functions.setAuth');
    expect(clientSource).toContain('session?.access_token');
  });

  it('initializes Functions auth from the current session and safely falls back to the anon key', () => {
    expect(clientSource).toContain('configuredSupabase.auth.getSession()');
    expect(clientSource).toContain('accessToken ?? fallbackToken');
  });

  it('passes the request bearer JWT explicitly to every server-side MFA assurance check', () => {
    for (const source of privilegedFunctionSources) {
      expect(source).toContain('bearerAccessToken(authorization)');
      expect(source).toContain('getAuthenticatorAssuranceLevel(accessToken)');
      expect(source).not.toContain('getAuthenticatorAssuranceLevel()');
    }
  });

  it('requires MFA for every established admin using account self-service', () => {
    expect(selfServiceSource).toContain(
      "currentProfile.role === 'admin' && !currentProfile.must_change_password"
    );
    expect(selfServiceSource).not.toContain('mandatoryMfaRoles');
  });
});
