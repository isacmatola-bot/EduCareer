import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./services/supabaseClient.ts', import.meta.url), 'utf8');

describe('Supabase Edge Function auth synchronization', () => {
  it('keeps the Functions authorization header aligned with Auth session changes', () => {
    expect(source).toContain('configuredSupabase.auth.onAuthStateChange');
    expect(source).toContain('configuredSupabase.functions.setAuth');
    expect(source).toContain('session?.access_token');
  });

  it('initializes Functions auth from the current session and safely falls back to the anon key', () => {
    expect(source).toContain('configuredSupabase.auth.getSession()');
    expect(source).toContain('accessToken ?? fallbackToken');
  });
});
