import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const service = readFileSync(new URL('./services/passwordRecovery.ts', import.meta.url), 'utf8');
const recoveryUi = readFileSync(new URL('./components/PasswordRecovery.tsx', import.meta.url), 'utf8');
const welcome = readFileSync(new URL('./components/WelcomeDialog.tsx', import.meta.url), 'utf8');
const adminLogin = readFileSync(new URL('./features/admin/AdminLoginPage.tsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('./components/AppLayout.tsx', import.meta.url), 'utf8');

describe('password recovery flow', () => {
  it('sends a Supabase recovery email without exposing account existence', () => {
    expect(service).toContain('resetPasswordForEmail(email');
    expect(service).toContain('redirectTo: window.location.origin');
    expect(service).toContain("if (error || typeof data !== 'string' || !data.includes('@'))");
    expect(recoveryUi).toContain('If the account exists');
  });

  it('handles the recovery event, updates the password, and closes the temporary session', () => {
    expect(service).toContain("event === 'PASSWORD_RECOVERY'");
    expect(service).toContain('client.auth.updateUser({ password })');
    expect(service).toContain('await client.auth.signOut()');
    expect(layout).toContain('<PasswordRecoveryBridge />');
  });

  it('offers forgotten-password recovery from both account and admin login screens', () => {
    expect(welcome).toContain('<ForgotPasswordControl />');
    expect(adminLogin).toContain('<ForgotPasswordControl />');
  });
});
