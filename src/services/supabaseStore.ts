import type { AccountRole, AdminRole, AuthSession, LoginForm, UserAccount } from '../auth';
import type { CandidateApplication, Opportunity, PartnerRequest, Program } from '../types';
import { requireSupabase } from './supabaseClient';

type AccountRegistrationInput = {
  role: AccountRole;
  username: string;
  password: string;
  displayName: string;
  email: string;
  phone?: string;
  adminRole?: AdminRole;
  candidate?: Omit<CandidateApplication, 'id' | 'username' | 'createdAt'>;
  partner?: Omit<PartnerRequest, 'id' | 'username' | 'createdAt'>;
};

export type SupabaseRegistrationResult = {
  account: UserAccount;
  requiresEmailConfirmation: boolean;
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

type SupabaseProgramRow = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  activities: string[];
  status: string;
};

type SupabaseOpportunityRow = {
  id: string;
  title: string;
  institution: string;
  location: string;
  opportunity_type: string;
  deadline: string;
  status: string;
  requirements: string[];
};

export type SupabaseSnapshot = {
  accounts: UserAccount[];
  candidates: CandidateApplication[];
  partners: PartnerRequest[];
  programs: Program[];
  opportunities: Opportunity[];
  session: AuthSession | null;
};

export async function loadSupabaseSnapshot(): Promise<SupabaseSnapshot> {
  const client = requireSupabase();
  const [programRows, opportunityRows] = await Promise.all([
    selectRows<SupabaseProgramRow>('programs', '*'),
    selectRows<SupabaseOpportunityRow>('opportunities', '*')
  ]);
  const programs = programRows.map(programRowToProgram);
  const opportunities = opportunityRows.map(opportunityRowToOpportunity);
  const { data: sessionData } = await client.auth.getSession();
  const sessionUser = sessionData.session?.user ?? null;

  if (!sessionUser) {
    return {
      accounts: [],
      candidates: [],
      partners: [],
      programs,
      opportunities,
      session: null
    };
  }

  const sessionProfile = await fetchSupabaseProfile(sessionUser.id);

  if (!sessionProfile) {
    return {
      accounts: [],
      candidates: [],
      partners: [],
      programs,
      opportunities,
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
      programs,
      opportunities,
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
    programs,
    opportunities,
    session
  };
}

export async function createSupabaseProgram(program: Program): Promise<Program> {
  const client = requireSupabase();
  const { data, error } = await client.from('programs').insert(programToRow(program)).select('*').single();
  if (error || !data) throw new Error(error?.message ?? 'Unable to create this program.');
  return programRowToProgram(data as SupabaseProgramRow);
}

export async function updateSupabaseProgram(program: Program): Promise<Program> {
  const client = requireSupabase();
  const { data, error } = await client.from('programs').update(programToRow(program)).eq('id', program.id).select('*').single();
  if (error || !data) throw new Error(error?.message ?? 'Unable to update this program.');
  return programRowToProgram(data as SupabaseProgramRow);
}

export async function createSupabaseOpportunity(opportunity: Opportunity): Promise<Opportunity> {
  const client = requireSupabase();
  const { id: _temporaryId, ...row } = opportunityToRow(opportunity);
  const { data, error } = await client.from('opportunities').insert(row).select('*').single();
  if (error || !data) throw new Error(error?.message ?? 'Unable to create this opportunity.');
  return opportunityRowToOpportunity(data as SupabaseOpportunityRow);
}

export async function updateSupabaseOpportunity(opportunity: Opportunity): Promise<Opportunity> {
  const client = requireSupabase();
  const { id: _id, ...row } = opportunityToRow(opportunity);
  const { data, error } = await client.from('opportunities').update(row).eq('id', opportunity.id).select('*').single();
  if (error || !data) throw new Error(error?.message ?? 'Unable to update this opportunity.');
  return opportunityRowToOpportunity(data as SupabaseOpportunityRow);
}

export async function applyToSupabaseOpportunity(opportunityId: string): Promise<void> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error('You must log in before applying.');

  const { error } = await client.from('opportunity_applications').insert({
    opportunity_id: opportunityId,
    account_id: userData.user.id
  });

  if (error?.code === '23505') throw new Error('You have already applied for this opportunity.');
  if (error) throw new Error(error.message);
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

export async function registerSupabaseAccount(input: AccountRegistrationInput): Promise<SupabaseRegistrationResult> {
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
        admin_role: adminRole,
        province: input.candidate?.province ?? '',
        institution: input.candidate?.institution ?? '',
        qualification: input.candidate?.qualification ?? '',
        teaching_area: input.candidate?.teachingArea ?? '',
        preferred_program: input.candidate?.preferredProgram ?? '',
        motivation: input.candidate?.motivation ?? '',
        organization_name: input.partner?.organizationName ?? '',
        contact_person: input.partner?.contactPerson ?? '',
        organization_type: input.partner?.organizationType ?? '',
        support_needed: input.partner?.supportNeeded ?? ''
      }
    }
  });

  if (signUpError) {
    throw new Error(signUpError.message);
  }

  const user = signUpData.user ?? null;
  const session = signUpData.session ?? null;

  if (!user) {
    throw new Error('Supabase did not return the newly created account.');
  }

  if (user.identities?.length === 0) {
    throw new Error('This email address is already registered. Confirm the existing account or log in.');
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

  if (!session) {
    return { account, requiresEmailConfirmation: true };
  }

  const profile = await ensureOwnProfile(account);

  return { account: profileToAccount(profile), requiresEmailConfirmation: false };
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
    throw new Error(await readFunctionError(error, 'Unable to create this admin account.'));
  }

  const payload = data as { profile?: SupabaseProfileRow; error?: string };
  if (payload.error || !payload.profile) {
    throw new Error(payload.error ?? 'Unable to create this admin account.');
  }

  return profileToAccount(payload.profile);
}

export async function updateSupabaseAccountProfile(accountId: string, patch: Partial<UserAccount>): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('admin-manage-user', {
    body: { action: 'update', accountId, patch }
  });
  const payload = data as { error?: string } | null;
  if (error) throw new Error(await readFunctionError(error, 'Unable to update this account.'));
  if (payload?.error) throw new Error(payload.error);
}

export async function deleteSupabaseAccountProfile(accountId: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('admin-manage-user', {
    body: { action: 'delete', accountId }
  });
  const payload = data as { error?: string } | null;
  if (error) throw new Error(await readFunctionError(error, 'Unable to delete this account.'));
  if (payload?.error) throw new Error(payload.error);
}

async function readFunctionError(error: unknown, fallback: string): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === 'string' && payload.error.trim() && payload.error.trim() !== '{}') {
          return payload.error.trim();
        }
      } catch {
        // Fall through to the SDK error below when the response is not JSON.
      }
    }
  }

  if (error instanceof Error && error.message.trim() && error.message.trim() !== '{}') {
    return error.message.trim();
  }

  return fallback;
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

function programRowToProgram(row: SupabaseProgramRow): Program {
  const status: Program['status'] = row.status === 'published' || row.status === 'closed' ? row.status : 'draft';
  return { id: row.id, name: row.name, tagline: row.tagline, description: row.description, activities: row.activities ?? [], status };
}

function programToRow(program: Program) {
  return {
    id: program.id,
    name: program.name,
    tagline: program.tagline,
    description: program.description,
    activities: program.activities,
    status: program.status
  };
}

function opportunityRowToOpportunity(row: SupabaseOpportunityRow): Opportunity {
  const allowedTypes: Opportunity['type'][] = ['Assistant Teacher', 'Internship', 'Mentorship', 'Seminar', 'Practice Teaching'];
  const type = allowedTypes.find((item) => item === row.opportunity_type) ?? 'Internship';
  const status: Opportunity['status'] = row.status === 'closed' ? 'Closed' : row.status === 'upcoming' ? 'Upcoming' : 'Open';
  return { id: row.id, title: row.title, institution: row.institution, location: row.location, type, deadline: row.deadline, status, requirements: row.requirements ?? [] };
}

function opportunityToRow(opportunity: Opportunity) {
  return {
    id: opportunity.id,
    title: opportunity.title,
    institution: opportunity.institution,
    location: opportunity.location,
    opportunity_type: opportunity.type,
    deadline: opportunity.deadline,
    status: opportunity.status.toLowerCase(),
    requirements: opportunity.requirements
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

async function ensureOwnProfile(account: UserAccount): Promise<SupabaseProfileRow> {
  const existingProfile = await fetchSupabaseProfile(account.id);

  if (existingProfile) {
    return existingProfile;
  }

  const client = requireSupabase();

  const { error } = await client.from('profiles').insert({
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

  const createdProfile = await fetchSupabaseProfile(account.id);

  if (!createdProfile) {
    throw new Error('Supabase created the auth user, but the EduCareer profile was not saved.');
  }

  return createdProfile;
}
