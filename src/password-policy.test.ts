import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  passwordMeetsPolicy,
  passwordPolicyMessage,
  passwordPolicyMinLength,
  passwordPolicyPattern
} from './security/passwordPolicy';

const candidateForm = readFileSync(new URL('./pages/CandidateFormPage.tsx', import.meta.url), 'utf8');
const partnerForm = readFileSync(new URL('./pages/PartnerFormPage.tsx', import.meta.url), 'utf8');
const accountPage = readFileSync(new URL('./pages/AccountPage.tsx', import.meta.url), 'utf8');
const portal = readFileSync(new URL('./pages/PortalPage.tsx', import.meta.url), 'utf8');
const recoveryUi = readFileSync(new URL('./components/PasswordRecovery.tsx', import.meta.url), 'utf8');
const registrationService = readFileSync(new URL('./services/supabaseStore.ts', import.meta.url), 'utf8');
const adminCreateFunction = readFileSync(new URL('../supabase/functions/admin-create-user/index.ts', import.meta.url), 'utf8');
const selfServiceFunction = readFileSync(new URL('../supabase/functions/account-self-service/index.ts', import.meta.url), 'utf8');

describe('production password policy', () => {
  it('requires at least 12 characters plus uppercase, lowercase, number and special character', () => {
    expect(passwordPolicyMinLength).toBe(12);
    expect(passwordMeetsPolicy('StrongPass123!')).toBe(true);
    expect(passwordMeetsPolicy('Aa1!short')).toBe(false);
    expect(passwordMeetsPolicy('lowercase123!')).toBe(false);
    expect(passwordMeetsPolicy('UPPERCASE123!')).toBe(false);
    expect(passwordMeetsPolicy('StrongPassword!')).toBe(false);
    expect(passwordMeetsPolicy('StrongPass123')).toBe(false);
    expect(passwordPolicyPattern).toContain('.{12,}');
    expect(passwordPolicyMessage).toContain('at least 12 characters');
  });

  it('shows the same browser policy on every password entry point', () => {
    for (const source of [candidateForm, partnerForm, accountPage, portal, recoveryUi]) {
      expect(source).toContain('passwordPolicyMinLength');
      expect(source).toContain('passwordPolicyPattern');
      expect(source).toContain('passwordPolicyMessage');
    }
    expect(candidateForm).toContain('graduate-password-requirements');
    expect(partnerForm).toContain('partner-password-requirements');
    expect(accountPage).toContain('account-password-requirements');
    expect(portal).toContain('admin-password-requirements');
    expect(recoveryUi).toContain('recovery-password-requirements');
  });

  it('enforces the same 12-character complexity rule before Supabase Auth calls', () => {
    expect(registrationService).toContain('passwordMeetsPolicy(password)');
    expect(registrationService).toContain('passwordPolicyMessage');
    expect(adminCreateFunction).toContain('password.length >= 12');
    expect(adminCreateFunction).toContain('passwordPolicyMessage');
    expect(selfServiceFunction).toContain('password.length >= 12');
    expect(selfServiceFunction).toContain('passwordPolicyMessage');
  });
});
