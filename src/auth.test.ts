import { describe, expect, it } from 'vitest';
import {
  authenticateAccount,
  adminRoleRequiresMfa,
  assertAccountCanSignIn,
  canAssignAdminRole,
  canCreateAdminAccount,
  canCreateAdminRole,
  canDeleteAccount,
  canManageAccount,
  canManageAdminRole,
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

describe('administrative hierarchy', () => {
  const graduate = account();

  it('makes the default admin the only role that can manage a CEO', () => {
    expect(canManageAdminRole('default_admin', 'ceo')).toBe(true);
    expect(canManageAdminRole('ceo', 'ceo')).toBe(false);
    expect(canManageAdminRole('director', 'ceo')).toBe(false);
    expect(canManageAccount(admin('default_admin'), admin('ceo'))).toBe(true);
    expect(canManageAccount(admin('ceo'), admin('ceo', 'ceo-peer'))).toBe(false);
  });

  it('allows CEO to manage Director and department admins, but not root or peer CEO', () => {
    const ceo = admin('ceo');
    expect(canManageAccount(ceo, admin('director'))).toBe(true);
    expect(canManageAccount(ceo, admin('programs'))).toBe(true);
    expect(canManageAccount(ceo, admin('default_admin'))).toBe(false);
    expect(canManageAccount(ceo, admin('ceo', 'ceo-peer'))).toBe(false);
  });

  it('limits Director governance to department admins and user accounts', () => {
    const director = admin('director');
    expect(canManageAccount(director, graduate)).toBe(true);
    expect(canManageAccount(director, admin('rh'))).toBe(true);
    expect(canManageAccount(director, admin('director', 'director-peer'))).toBe(false);
    expect(canManageAccount(director, admin('ceo'))).toBe(false);
  });

  it.each(['it', 'support'] as AdminRole[])('%s can maintain public-user accounts but no admin account', (role) => {
    const actor = admin(role);
    expect(canManageAccount(actor, graduate)).toBe(true);
    expect(canManageAccount(actor, admin('programs'))).toBe(false);
    expect(canManageAccount(actor, admin('director'))).toBe(false);
    expect(canCreateAdminAccount(actor)).toBe(false);
    expect(canAssignAdminRole(actor)).toBe(false);
  });

  it('never allows creation or assignment of default_admin', () => {
    expect(canCreateAdminRole(admin('default_admin'), 'default_admin')).toBe(false);
    expect(canCreateAdminRole(admin('ceo'), 'default_admin')).toBe(false);
    expect(canCreateAdminRole(admin('director'), 'default_admin')).toBe(false);
  });

  it('applies creation hierarchy by actor level', () => {
    expect(canCreateAdminRole(admin('default_admin'), 'ceo')).toBe(true);
    expect(canCreateAdminRole(admin('default_admin'), 'director')).toBe(true);
    expect(canCreateAdminRole(admin('ceo'), 'ceo')).toBe(false);
    expect(canCreateAdminRole(admin('ceo'), 'director')).toBe(true);
    expect(canCreateAdminRole(admin('ceo'), 'finance')).toBe(true);
    expect(canCreateAdminRole(admin('director'), 'director')).toBe(false);
    expect(canCreateAdminRole(admin('director'), 'programs')).toBe(true);
  });

  it('prevents executive deletion across the same or higher hierarchy', () => {
    expect(canDeleteAccount(admin('default_admin'), admin('ceo'))).toBe(true);
    expect(canDeleteAccount(admin('ceo'), admin('director'))).toBe(true);
    expect(canDeleteAccount(admin('ceo'), admin('ceo', 'ceo-peer'))).toBe(false);
    expect(canDeleteAccount(admin('director'), admin('ceo'))).toBe(false);
    expect(canDeleteAccount(admin('director'), admin('rh'))).toBe(true);
    expect(canDeleteAccount(admin('it'), graduate)).toBe(false);
  });
});

describe('administrative permissions', () => {
  it('separates read and manage permissions by department', () => {
    expect(hasAdminPermission(admin('programs'), 'programs.read')).toBe(true);
    expect(hasAdminPermission(admin('programs'), 'programs.manage')).toBe(true);
    expect(hasAdminPermission(admin('programs'), 'candidates.read')).toBe(false);

    expect(hasAdminPermission(admin('partnerships'), 'partner_requests.read')).toBe(true);
    expect(hasAdminPermission(admin('partnerships'), 'partner_requests.manage')).toBe(true);

    expect(hasAdminPermission(admin('rh'), 'candidates.read')).toBe(true);
    expect(hasAdminPermission(admin('rh'), 'applications.manage')).toBe(true);
    expect(hasAdminPermission(admin('rh'), 'partner_requests.read')).toBe(false);
  });

  it('keeps Finance and Statistics away from raw operational records', () => {
    expect(hasAdminPermission(admin('finance'), 'finance.read')).toBe(true);
    expect(hasAdminPermission(admin('finance'), 'candidates.read')).toBe(false);
    expect(hasAdminPermission(admin('finance'), 'partner_requests.read')).toBe(false);

    expect(hasAdminPermission(admin('statistics'), 'statistics.read_aggregate')).toBe(true);
    expect(hasAdminPermission(admin('statistics'), 'candidates.read')).toBe(false);
    expect(hasAdminPermission(admin('statistics'), 'applications.read')).toBe(false);
  });

  it('limits IT and Support reads to public-user account scope', () => {
    for (const role of ['it', 'support'] as AdminRole[]) {
      expect(hasAdminPermission(admin(role), 'accounts.read_users')).toBe(true);
      expect(hasAdminPermission(admin(role), 'accounts.read_all')).toBe(false);
      expect(hasAdminPermission(admin(role), 'accounts.maintain')).toBe(true);
    }
  });

  it('denies permissions to inactive admins and temporary-password sessions', () => {
    const inactive = { ...admin('it'), status: 'disabled' as const };
    expect(canManageAccount(inactive, account())).toBe(false);
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
    expect(adminRoleRequiresMfa(account())).toBe(false);
  });
});
