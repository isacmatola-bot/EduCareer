import { describe, expect, it } from 'vitest';
import {
  authenticateAccount,
  adminRoleRequiresMfa,
  assertAccountCanSignIn,
  canAssignAdminRole,
  canCreateAdminAccount,
  canDeleteAccount,
  canManageAccount,
  hasAdminPermission,
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
    expect(() => assertAccountCanSignIn(account({ status: 'rejected' }))).toThrow('rejected');
    expect(() => assertAccountCanSignIn(account({ status: 'active' }))).not.toThrow();
  });
});

describe('administrative permissions', () => {
  const graduate = account();
  const leaders: AdminRole[] = ['default_admin', 'ceo', 'director'];

  it.each(leaders)('%s has full governance and departmental permissions', (role) => {
    const actor = admin(role);
    expect(canCreateAdminAccount(actor)).toBe(true);
    expect(canAssignAdminRole(actor)).toBe(true);
    expect(canManageAccount(actor, graduate)).toBe(true);
    expect(canManageAccount(actor, admin('director'))).toBe(true);
    expect(hasAdminPermission(actor, 'programs.manage')).toBe(true);
    expect(hasAdminPermission(actor, 'opportunities.manage')).toBe(true);
  });

  it.each(['it', 'support'] as AdminRole[])('%s can maintain all non-protected accounts without governance', (role) => {
    const actor = admin(role);
    expect(canManageAccount(actor, graduate)).toBe(true);
    expect(canManageAccount(actor, admin('director'))).toBe(true);
    expect(canCreateAdminAccount(actor)).toBe(false);
    expect(canAssignAdminRole(actor)).toBe(false);
    expect(hasAdminPermission(actor, 'programs.manage')).toBe(false);
  });

  it('protects the default admin while allowing executive deletion of other accounts', () => {
    expect(canManageAccount(admin('ceo'), admin('default_admin'))).toBe(false);
    expect(canDeleteAccount(admin('ceo'), graduate)).toBe(true);
    expect(canDeleteAccount(admin('director'), admin('ceo'))).toBe(true);
    expect(canDeleteAccount(admin('default_admin'), admin('default_admin'))).toBe(false);
    expect(canDeleteAccount(admin('it'), graduate)).toBe(false);
  });

  it('gives each department write access only to its own area', () => {
    expect(hasAdminPermission(admin('programs'), 'programs.manage')).toBe(true);
    expect(hasAdminPermission(admin('programs'), 'opportunities.manage')).toBe(false);
    expect(hasAdminPermission(admin('partnerships'), 'partner_requests.manage')).toBe(true);
    expect(hasAdminPermission(admin('rh'), 'candidates.manage')).toBe(true);
    expect(hasAdminPermission(admin('statistics'), 'programs.manage')).toBe(false);
  });

  it('denies permissions to inactive admins and temporary-password sessions', () => {
    const inactive = { ...admin('it'), status: 'disabled' as const };
    expect(canManageAccount(inactive, graduate)).toBe(false);
    expect(hasAdminPermission(inactive, 'accounts.maintain')).toBe(false);

    const temporary = { ...admin('ceo'), mustChangePassword: true };
    expect(canCreateAdminAccount(temporary)).toBe(false);
    expect(hasAdminPermission(temporary, 'programs.manage')).toBe(false);
  });

  it('requires MFA for every administrative role', () => {
    const roles: AdminRole[] = [
      'default_admin', 'ceo', 'director', 'it', 'rh', 'finance', 'programs',
      'opportunities', 'partnerships', 'support', 'statistics'
    ];
    for (const role of roles) {
      expect(adminRoleRequiresMfa(admin(role))).toBe(true);
    }
    expect(adminRoleRequiresMfa(graduate)).toBe(false);
  });
});
