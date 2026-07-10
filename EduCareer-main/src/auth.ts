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
  status: 'active' | 'pending' | 'disabled';
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

export const defaultAdminCredentials = {
  username: 'default.admin',
  password: 'EduCareer@2026'
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

export function seedDefaultAdmin(accounts: UserAccount[]): UserAccount[] {
  const hasDefaultAdmin = accounts.some((account) => account.id === 'admin-default');

  if (hasDefaultAdmin) {
    return accounts;
  }

  return [
    {
      id: 'admin-default',
      role: 'admin',
      adminRole: 'default_admin',
      username: defaultAdminCredentials.username,
      passwordHash: hashPassword(defaultAdminCredentials.password),
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

  return { account };
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
