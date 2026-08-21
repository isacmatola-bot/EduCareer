import { isLocalDemoEnabled } from './config';

export type AccountRole = 'graduate' | 'partner' | 'admin';

export type ViewerRole = AccountRole | 'visitor';

export type AdminRole =
  | 'default_admin'
  | 'ceo'
  | 'director'
  | 'it'
  | 'rh'
  | 'finance'
  | 'programs'
  | 'opportunities'
  | 'partnerships'
  | 'support'
  | 'statistics';

export type AdminPermission =
  | 'accounts.read_all'
  | 'accounts.read_users'
  | 'accounts.maintain'
  | 'accounts.govern'
  | 'accounts.create_admin'
  | 'accounts.delete'
  | 'candidates.read'
  | 'candidates.manage'
  | 'partner_requests.read'
  | 'partner_requests.manage'
  | 'programs.read'
  | 'programs.manage'
  | 'opportunities.read'
  | 'opportunities.manage'
  | 'applications.read'
  | 'applications.manage'
  | 'placements.read'
  | 'placements.manage'
  | 'audit.read'
  | 'finance.read'
  | 'statistics.read_aggregate';

export type AuthSession =
  | { mode: 'visitor' }
  | { mode: 'account'; accountId: string };

export type UserAccount = {
  id: string;
  role: AccountRole;
  adminRole?: AdminRole;
  username: string;
  passwordHash: string;
  displayName: string;
  email: string;
  phone?: string;
  createdAt: string;
  status: 'active' | 'pending' | 'rejected' | 'disabled';
  mustChangePassword?: boolean;
};

type AccountInput = {
  role: AccountRole;
  username: string;
  password: string;
  displayName: string;
  email: string;
  phone?: string;
  adminRole?: AdminRole;
};

export type LoginForm = {
  username: string;
  password: string;
};

export type RegistrationMode = 'graduate' | 'partner';

const localDemoAdminCredentials = {
  username: import.meta.env.VITE_LOCAL_DEMO_ADMIN_USERNAME?.trim(),
  password: import.meta.env.VITE_LOCAL_DEMO_ADMIN_PASSWORD
};

export const adminRoleLabels: Record<AdminRole, string> = {
  default_admin: 'Default Admin',
  ceo: 'CEO',
  director: 'Director',
  it: 'IT',
  rh: 'RH',
  finance: 'Finance',
  programs: 'Programs',
  opportunities: 'Opportunities',
  partnerships: 'Partnerships',
  support: 'Support',
  statistics: 'Statistics'
};

export const roleLabels: Record<ViewerRole, string> = {
  visitor: 'Visitor',
  graduate: 'Graduate Account',
  partner: 'Partner Account',
  admin: 'Admin Account'
};

export const departmentAdminRoles: readonly AdminRole[] = [
  'it', 'rh', 'finance', 'programs', 'opportunities', 'partnerships', 'support', 'statistics'
];

export const adminHierarchyLevel: Record<AdminRole, number> = {
  default_admin: 0,
  ceo: 1,
  director: 2,
  it: 3,
  rh: 3,
  finance: 3,
  programs: 3,
  opportunities: 3,
  partnerships: 3,
  support: 3,
  statistics: 3
};

const leadershipPermissions: AdminPermission[] = [
  'accounts.read_all',
  'accounts.read_users',
  'accounts.maintain',
  'accounts.govern',
  'accounts.create_admin',
  'accounts.delete',
  'candidates.read',
  'candidates.manage',
  'partner_requests.read',
  'partner_requests.manage',
  'programs.read',
  'programs.manage',
  'opportunities.read',
  'opportunities.manage',
  'applications.read',
  'applications.manage',
  'placements.read',
  'placements.manage',
  'audit.read',
  'finance.read',
  'statistics.read_aggregate'
];

export const adminPermissions: Record<AdminRole, readonly AdminPermission[]> = {
  default_admin: leadershipPermissions,
  ceo: leadershipPermissions,
  director: leadershipPermissions,
  it: ['accounts.read_users', 'accounts.maintain'],
  support: ['accounts.read_users', 'accounts.maintain'],
  rh: [
    'candidates.read', 'candidates.manage',
    'applications.read', 'applications.manage',
    'placements.read', 'placements.manage'
  ],
  finance: ['finance.read'],
  programs: ['programs.read', 'programs.manage'],
  opportunities: [
    'opportunities.read', 'opportunities.manage',
    'applications.read', 'applications.manage',
    'placements.read', 'placements.manage'
  ],
  partnerships: ['partner_requests.read', 'partner_requests.manage'],
  statistics: ['statistics.read_aggregate']
};

export function adminRoleRequiresMfa(account: UserAccount | null | undefined): boolean {
  return Boolean(account?.role === 'admin');
}

export function hasAdminPermission(
  account: UserAccount | null | undefined,
  permission: AdminPermission
): boolean {
  return Boolean(
    account?.role === 'admin' &&
    account.status === 'active' &&
    !account.mustChangePassword &&
    account.adminRole &&
    adminPermissions[account.adminRole].includes(permission)
  );
}

export function canManageOperations(account: UserAccount | null | undefined): boolean {
  return hasAdminPermission(account, 'accounts.maintain');
}

function isDepartmentRole(role: AdminRole): boolean {
  return departmentAdminRoles.includes(role);
}

export function canManageAdminRole(actorRole: AdminRole, targetRole: AdminRole): boolean {
  if (targetRole === 'default_admin' || actorRole === targetRole) return false;
  if (actorRole === 'default_admin') return true;
  if (actorRole === 'ceo') return targetRole === 'director' || isDepartmentRole(targetRole);
  if (actorRole === 'director') return isDepartmentRole(targetRole);
  return false;
}

export function canCreateAdminRole(
  actor: UserAccount | null | undefined,
  targetRole: AdminRole
): boolean {
  if (!canCreateAdminAccount(actor) || !actor?.adminRole || targetRole === 'default_admin') return false;
  if (actor.adminRole === 'default_admin') return true;
  if (actor.adminRole === 'ceo') return targetRole === 'director' || isDepartmentRole(targetRole);
  if (actor.adminRole === 'director') return isDepartmentRole(targetRole);
  return false;
}

export function canManageAccount(
  actor: UserAccount | null | undefined,
  target: UserAccount | null | undefined
): boolean {
  if (!hasAdminPermission(actor, 'accounts.maintain') || !target) return false;
  if (target.role !== 'admin') return true;
  if (!actor?.adminRole || !target.adminRole || target.id === actor.id) return false;
  if (!hasAdminPermission(actor, 'accounts.govern')) return false;
  return canManageAdminRole(actor.adminRole, target.adminRole);
}

export function canAssignAdminRole(account: UserAccount | null | undefined): boolean {
  return hasAdminPermission(account, 'accounts.govern');
}

export function canCreateAdminAccount(account: UserAccount | null | undefined): boolean {
  return hasAdminPermission(account, 'accounts.create_admin');
}

export function canDeleteAccount(
  actor: UserAccount | null | undefined,
  target: UserAccount | null | undefined
): boolean {
  if (!hasAdminPermission(actor, 'accounts.delete') || !target || target.id === actor?.id) return false;
  if (target.role !== 'admin') return true;
  if (!actor?.adminRole || !target.adminRole) return false;
  return canManageAdminRole(actor.adminRole, target.adminRole);
}

export function seedDefaultAdmin(accounts: UserAccount[]): UserAccount[] {
  if (!isLocalDemoEnabled) {
    return accounts;
  }

  if (!localDemoAdminCredentials.username || !localDemoAdminCredentials.password) {
    return accounts;
  }

  const hasDefaultAdmin = accounts.some((account) => account.id === 'admin-default');

  if (hasDefaultAdmin) {
    return accounts;
  }

  if (!localDemoAdminCredentials.username || !localDemoAdminCredentials.password) {
    return accounts;
  }

  return [
    {
      id: 'admin-default',
      role: 'admin',
      adminRole: 'default_admin',
      username: localDemoAdminCredentials.username,
      passwordHash: hashPassword(localDemoAdminCredentials.password),
      displayName: 'Default EduCareer Admin',
      email: 'admin@educareer.local',
      createdAt: new Date().toISOString(),
      status: 'active'
    },
    ...accounts
  ];
}

export function createAccount(accounts: UserAccount[], input: AccountInput) {
  const username = normalizeUsername(input.username);

  if (username.length < 3) {
    return { error: 'Username must contain at least 3 characters.' };
  }

  if (input.password.length < 8) {
    return { error: 'Password must contain at least 8 characters.' };
  }

  if (accounts.some((account) => normalizeUsername(account.username) === username)) {
    return { error: 'This username is already registered. Choose another username or log in.' };
  }

  const account: UserAccount = {
    id: makeAccountId(input.role),
    role: input.role,
    adminRole: input.role === 'admin' ? input.adminRole ?? 'default_admin' : undefined,
    username,
    passwordHash: hashPassword(input.password),
    displayName: input.displayName.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim(),
    createdAt: new Date().toISOString(),
    status: input.role === 'admin' ? 'active' : 'pending'
  };

  return { account, accounts: [account, ...accounts] };
}

export function authenticateAccount(accounts: UserAccount[], credentials: LoginForm) {
  const username = normalizeUsername(credentials.username);
  const passwordHash = hashPassword(credentials.password);
  const account = accounts.find((item) => normalizeUsername(item.username) === username);

  if (!account || account.passwordHash !== passwordHash) {
    return { error: 'Invalid username or password.' };
  }

  if (account.status === 'disabled') {
    return { error: 'This account is disabled. Contact EduCareer support.' };
  }
  if (account.status === 'rejected') {
    return { error: 'This account application was rejected. Contact EduCareer support.' };
  }

  return { account };
}

export function assertAccountCanSignIn(account: UserAccount): void {
  if (account.status === 'disabled') {
    throw new Error('This account is disabled. Contact EduCareer support.');
  }
  if (account.status === 'rejected') {
    throw new Error('This account application was rejected. Contact EduCareer support.');
  }
}

export function accountDisplay(account: UserAccount | null | undefined): string {
  if (!account) {
    return roleLabels.visitor;
  }

  if (account.role === 'admin' && account.adminRole) {
    return `${account.displayName} · ${adminRoleLabels[account.adminRole]}`;
  }

  return `${account.displayName} · ${roleLabels[account.role]}`;
}

export function sessionForAccount(account: UserAccount): AuthSession {
  return { mode: 'account', accountId: account.id };
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function makeAccountId(role: AccountRole): string {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hashPassword(password: string): string {
  const credential = `educareer-local-auth:${password}`;

  try {
    return window.btoa(unescape(encodeURIComponent(credential)));
  } catch {
    return credential;
  }
}
