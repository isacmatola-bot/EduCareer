import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { passwordMeetsPolicy, passwordPolicyPattern } from './security/passwordPolicy';

const candidateForm = readFileSync(new URL('./pages/CandidateFormPage.tsx', import.meta.url), 'utf8');
const partnerForm = readFileSync(new URL('./pages/PartnerFormPage.tsx', import.meta.url), 'utf8');
const accountPage = readFileSync(new URL('./pages/AccountPage.tsx', import.meta.url), 'utf8');
const recoveryUi = readFileSync(new URL('./components/PasswordRecovery.tsx', import.meta.url), 'utf8');

describe('production password policy', () => {
  it('requires uppercase, lowercase, number, special character and eight characters', () => {
    expect(passwordMeetsPolicy('StrongPass123!')).toBe(true);
    expect(passwordMeetsPolicy('lowercase123!')).toBe(false);
    expect(passwordMeetsPolicy('UPPERCASE123!')).toBe(false);
    expect(passwordMeetsPolicy('StrongPassword!')).toBe(false);
    expect(passwordMeetsPolicy('StrongPass123')).toBe(false);
    expect(passwordMeetsPolicy('Aa1!')).toBe(false);
  });

  it('exposes the same browser pattern on all public/self-service password entry points', () => {
    expect(passwordPolicyPattern).toContain('(?=.*[a-z])');
    expect(candidateForm).toContain('pattern={passwordPolicyPattern}');
    expect(partnerForm).toContain('pattern={passwordPolicyPattern}');
    expect(accountPage).toContain('pattern={passwordPolicyPattern}');
    expect(recoveryUi).toContain('pattern={passwordPolicyPattern}');
  });
});
