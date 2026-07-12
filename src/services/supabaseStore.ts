import type { AccountRole, AdminRole, AuthSession, LoginForm, UserAccount } from '../auth';
import type { CandidateApplication, PartnerRequest } from '../types';
import { requireSupabase } from './supabaseClient';

type AccountRegistrationInput = {
  role: AccountRole;
  username: string;
  password: string;
  displayName: string;
  email: string;
  phone?: string;
  adminRole?: AdminRole;
};

type SupabaseProfileRow = {
  id: string;
  role: string;
  admin_role: string | null;
  username: string;
  display_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
};

type SupabaseCandidateRow = {
  id: string;
  account_id: string | null;
  username: string | null;
  full_name: string;
  email: string;
  phone: string;
  province: string;
  institution: string;
  qualification: string;
  teaching_area: string;
  preferred_program: string;
  motivation: string;
  created_at: string;
};

type SupabasePartnerRow = {
  id: string;
  account_id: string | null;
  username: string | null;
  organization_name: string;
  contact_person: string;
  email: string;
  phone: string;
  organization_type: string;
  support_needed: string;
  created_at: string;
};

export type SupabaseSnapshot = {
  accounts: UserAccount[];
  candidates: CandidateApplication[];
  partners: PartnerRequest[];
  session: AuthSession | null;
};

export async function loadSupabaseSnapshot(): Promise<SupabaseSnapshot> {
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const sessionUser = sessionData.session?.user ?? null;

  if (!sessionUser) {
    return {
      accounts: [],
      candidates: [],
      partners: [],
      session: null
    };
  }

  const sessionProfile = await fetchSupabaseProfile(sessionUser.id);

  if (!sessionProfile) {
    return {
      accounts: [],
      candidates: [],
      partners: [],
      session: null
    };
  }

  const account = profileToAccount(sessionProfile);
  const session: AuthSession = { mode: 'account', accountId: sessionUser.id };

  if (account.role === 'admin') {
    const [profileRows, candidateRows, partnerRows] = await Promise.all([
      selectRows<SupabaseProfileRow>('profiles', '*'),
      selectRows<SupabaseCandidateRow>('candidates', '*'),
      selectRows<SupabasePartnerRow>('partner_requests', '*')
    ]);

    return {
      accounts: profileRows.map(profileToAccount),
      candidates: candidateRows.map(candidateRowToApplication),
      partners: partnerRows.map(partnerRowToRequest),
      session
    };
  }

  const [candidateRows, partnerRows] = await Promise.all([
    account.role === 'graduate'
      ? selectRows<SupabaseCandidateRow>('candidates', '*')
      : Promise.resolve([] as SupabaseCandidateRow[]),

    account.role === 'partner'
      ? selectRows<SupabasePartnerRow>('partner_requests', '*')
      : Promise.resolve([] as SupabasePartnerRow[])
  ]);

  return {
    accounts: [account],
    candidates: candidateRows.map(candidateRowToApplication),
    partners: partnerRows.map(partnerRowToRequest),
    session
  };
}

export async function signInSupabaseAccount(credentials: LoginForm): Promise<UserAccount> {
  const client = requireSupabase();
  const email = await resolveLoginEmail(credentials.username);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: credentials.password
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? 'Invalid username or password.');
  }

  const profile = await fetchSupabaseProfile(data.user.id);
  if (!profile) {
    throw new Error('No EduCareer profile is connected to this account.');
  }

  return profileToAccount(profile);
}

export async function signOutSupabaseAccount(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

export async function registerSupabaseAccount(input: AccountRegistrationInput): Promise<UserAccount> {
  const client = requireSupabase();
  const username = normalizeUsername(input.username);
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const displayName = input.displayName.trim();
  const phone = input.phone?.trim();
  const adminRole = input.role === 'admin' ? input.adminRole ?? 'director' : null;

  if (username.length < 3) {
    throw new Error('Username must contain at least 3 characters.');
  }

  if (password.length < 8) {
    throw new Error('Password must contain at least 8 characters.');
  }

  const { data: signUpData, error: signUpError } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        display_name: displayName,
        phone: phone ?? '',
        role: input.role,
        admin_role: adminRole
      }
    }
  });

  if (signUpError) {
    throw new Error(signUpError.message);
  }

  let user = signUpData.user ?? null;
  let session = signUpData.session ?? null;

  if (!user || !session) {
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      throw new Error(signInError.message);
    }

    user = signInData.user ?? null;
    session = signInData.session ?? null;
  }

  if (!user || !session) {
    throw new Error('Account was created, but no active Supabase session was returned.');
  }

  const account: UserAccount = {
    id: user.id,
    role: input.role,
    adminRole: adminRole ?? undefined,
    username,
    passwordHash: 'supabase-auth',
    displayName,
    email,
    phone,
    createdAt: new Date().toISOString(),
    status: input.role === 'admin' ? 'active' : 'pending'
  };

  await upsertOwnProfile(account);

  const profile = await fetchSupabaseProfile(user.id);

  if (!profile) {
    throw new Error('Supabase created the auth user, but the EduCareer profile was not saved.');
  }

  return profileToAccount(profile);
}

export async function insertSupabaseCandidate(application: CandidateApplication, accountId?: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('candidates').insert({
    account_id: accountId ?? null,
    username: application.username,
    full_name: application.fullName,
    email: application.email,
    phone: application.phone,
    province: application.province,
    institution: application.institution,
    qualification: application.qualification,
    teaching_area: application.teachingArea,
    preferred_program: application.preferredProgram,
    motivation: application.motivation
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function insertSupabasePartnerRequest(request: PartnerRequest, accountId?: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('partner_requests').insert({
    account_id: accountId ?? null,
    username: request.username,
    organization_name: request.organizationName,
    contact_person: request.contactPerson,
    email: request.email,
    phone: request.phone,
    organization_type: request.organizationType,
    support_needed: request.supportNeeded
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createSupabaseAdminAccount(input: AccountRegistrationInput): Promise<UserAccount> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('admin-create-user', {
    body: input
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = data as { profile?: SupabaseProfileRow; error?: string };
  if (payload.error || !payload.profile) {
    throw new Error(payload.error ?? 'Unable to create this admin account.');
  }

  return profileToAccount(payload.profile);
}

export async function updateSupabaseAccountProfile(accountId: string, patch: Partial<UserAccount>): Promise<void> {
  const client = requireSupabase();
  const payload: Record<string, string | null> = {};

  if (patch.displayName !== undefined) payload.display_name = patch.displayName;
  if (patch.email !== undefined) payload.email = patch.email;
  if (patch.phone !== undefined) payload.phone = patch.phone ?? null;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.adminRole !== undefined) payload.admin_role = patch.adminRole ?? null;

  const { error } = await client.from('profiles').update(payload).eq('id', accountId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteSupabaseAccountProfile(accountId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('profiles').delete().eq('id', accountId);

  if (error) {
    throw new Error(error.message);
  }
}

async function resolveLoginEmail(login: string): Promise<string> {
  const trimmed = login.trim();
  if (trimmed.includes('@')) {
    return trimmed;
  }

  const client = requireSupabase();
  const { data, error } = await client.rpc('get_login_email', {
    login_username: normalizeUsername(trimmed)
  });

  if (error || typeof data !== 'string') {
    throw new Error('Invalid username or password.');
  }

  return data;
}

async function selectRows<T>(table: string, columns: string): Promise<T[]> {
  const client = requireSupabase();
  const { data, error } = await client.from(table).select(columns).order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as T[];
}

async function fetchSupabaseProfile(userId: string): Promise<SupabaseProfileRow | null> {
  const client = requireSupabase();
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();

  if (error) {
    return null;
  }

  return data as SupabaseProfileRow | null;
}

async function upsertOwnProfile(account: UserAccount): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('profiles').upsert({
    id: account.id,
    username: account.username,
    email: account.email,
    display_name: account.displayName,
    phone: account.phone ?? null,
    role: account.role,
    admin_role: account.adminRole ?? null,
    status: account.status
  });

  if (error) {
    throw new Error(error.message);
  }
}

function profileToAccount(profile: SupabaseProfileRow): UserAccount {
  const role = coerceRole(profile.role);

  return {
    id: profile.id,
    role,
    adminRole: role === 'admin' ? coerceAdminRole(profile.admin_role) : undefined,
    username: profile.username,
    passwordHash: 'supabase-auth',
    displayName: profile.display_name,
    email: profile.email,
    phone: profile.phone ?? undefined,
    createdAt: profile.created_at,
    status: coerceStatus(profile.status)
  };
}

function candidateRowToApplication(row: SupabaseCandidateRow): CandidateApplication {
  return {
    id: row.id,
    username: row.username ?? '',
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    province: row.province,
    institution: row.institution,
    qualification: row.qualification,
    teachingArea: row.teaching_area,
    preferredProgram: row.preferred_program,
    motivation: row.motivation,
    createdAt: row.created_at
  };
}

function partnerRowToRequest(row: SupabasePartnerRow): PartnerRequest {
  return {
    id: row.id,
    username: row.username ?? '',
    organizationName: row.organization_name,
    contactPerson: row.contact_person,
    email: row.email,
    phone: row.phone,
    organizationType: row.organization_type,
    supportNeeded: row.support_needed,
    createdAt: row.created_at
  };
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function coerceRole(role: string): AccountRole {
  if (role === 'admin' || role === 'partner' || role === 'graduate') {
    return role;
  }

  return 'graduate';
}

function coerceAdminRole(role: string | null): AdminRole {
  const adminRoles: AdminRole[] = [
    'default_admin',
    'ceo',
    'director',
    'it',
    'rh',
    'finance',
    'programs',
    'opportunities',
    'partnerships',
    'support',
    'statistics'
  ];

  return adminRoles.find((item) => item === role) ?? 'director';
}

function coerceStatus(status: string): UserAccount['status'] {
  if (status === 'active' || status === 'pending' || status === 'disabled') {
    return status;
  }

  return 'pending';
}
