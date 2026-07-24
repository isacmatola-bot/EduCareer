import { describe, expect, it } from 'vitest';
import {
  authenticateAccount,
  assertAccountCanSignIn,
  canDeleteAccount,
  canManageAccount,
  canManageOperations,
  createAccount,
  type AdminRole,
  type UserAccount
} from './auth';

function account(overrides: Partial<UserAccount> = {}): UserAccount {
  return {
    id: 'account-1',
    role: 'graduate',
    username: 'graduate.user',
    passwordHash: 'unused',
    displayName: 'Graduate User',
    email: 'graduate@example.com',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'active',
    ...overrides
  };
}

function admin(adminRole: AdminRole, id = `admin-${adminRole}`): UserAccount {
  return account({ id, role: 'admin', adminRole, username: id, email: `${id}@example.com` });
}

describe('authentication', () => {
  it('creates public registrations as pending accounts', () => {
    const result = createAccount([], {
      role: 'graduate', username: 'New.User', password: 'SecurePass9!',
      displayName: 'New User', email: 'new@example.com'
    });
    expect(result.account).toMatchObject({ username: 'new.user', status: 'pending', role: 'graduate' });
  });

  it('rejects invalid passwords and disabled accounts', () => {
    const created = createAccount([], {
      role: 'partner', username: 'partner', password: 'SecurePass9!',
      displayName: 'Partner', email: 'partner@example.com'
    }).account!;
    expect(authenticateAccount([created], { username: 'partner', password: 'wrong' }).error).toBeTruthy();
    expect(authenticateAccount([{ ...created, status: 'disabled' }], {
      username: 'partner', password: 'SecurePass9!'
    }).error).toContain('disabled');
  });

  it('rejects a disabled account returned by Supabase authentication', () => {
    expect(() => assertAccountCanSignIn(account({ status: 'disabled' }))).toThrow('disabled');
    expect(() => assertAccountCanSignIn(account({ status: 'active' }))).not.toThrow();
  });
});

describe('administrative permissions', () => {
  const graduate = account();
  const roles: AdminRole[] = ['default_admin', 'ceo', 'director', 'it'];

  it.each(roles)('%s can manage operational content and non-admin accounts', (role) => {
    const actor = admin(role);
    expect(canManageOperations(actor)).toBe(true);
    expect(canManageAccount(actor, graduate)).toBe(true);
  });

  it.each(['ceo', 'director', 'it'] as AdminRole[])('%s cannot manage admin accounts', (role) => {
    expect(canManageAccount(admin(role), admin('director'))).toBe(false);
  });

  it('reserves admin-account management and deletion for the default admin', () => {
    const actor = admin('default_admin');
    expect(canManageAccount(actor, admin('director'))).toBe(true);
    expect(canDeleteAccount(actor, graduate)).toBe(true);
    expect(canDeleteAccount(actor, actor)).toBe(false);
    expect(canDeleteAccount(admin('ceo'), graduate)).toBe(false);
  });

  it('denies operational permissions to inactive admins', () => {
    const inactive = { ...admin('it'), status: 'disabled' as const };
    expect(canManageOperations(inactive)).toBe(false);
    expect(canManageAccount(inactive, graduate)).toBe(false);
  });
});
