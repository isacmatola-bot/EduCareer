import { createClient } from 'npm:@supabase/supabase-js@2';

const productionOrigin = 'https://edu-career-chi.vercel.app';
const previewOriginPattern =
  /^https:\/\/edu-career-[a-z0-9-]+-2kgmcorp\.vercel\.app$/;
const passwordPolicyMessage =
  'Password must contain at least 12 characters, including at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.';

type AdminDraft = {
  username?: string;
  password?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  adminRole?: string;
};

const departmentAdminRoles = new Set([
  'it', 'rh', 'finance', 'programs', 'opportunities', 'partnerships', 'support', 'statistics'
]);
const adminCreatorRoles = new Set(['default_admin', 'ceo', 'director']);
const allowedAdminRoles = new Set([
  'ceo', 'director', ...departmentAdminRoles
]);

Deno.serve(async (request) => {
  const origin = allowedOrigin(request);
  if (!origin) return json({ error: 'Origin not allowed.' }, 403, productionOrigin);
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, origin);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey =
      Deno.env.get('EDUCAREER_SECRET_KEY') ??
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: 'Supabase function environment is incomplete.' }, 500, origin);
    }

    const authorization = request.headers.get('Authorization');
    if (!authorization) {
      return json({ error: 'Missing authorization header.' }, 401, origin);
    }
    const accessToken = bearerAccessToken(authorization);
    if (!accessToken) {
      return json({ error: 'Invalid authorization header.' }, 401, origin);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } }
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: 'Unauthorized request.' }, 401, origin);
    }
    const { data: aalData, error: aalError } = await userClient.auth.mfa.getAuthenticatorAssuranceLevel(accessToken);
    if (aalError || aalData.currentLevel !== 'aal2') {
      return json({ error: 'Multi-factor authentication is required for this operation.' }, 403, origin);
    }

    const { data: callerProfile, error: callerError } = await serviceClient
      .from('profiles')
      .select('role, admin_role, status, must_change_password')
      .eq('id', userData.user.id)
      .single();

    if (
      callerError ||
      callerProfile?.role !== 'admin' ||
      !adminCreatorRoles.has(callerProfile?.admin_role ?? '') ||
      callerProfile?.status !== 'active' ||
      callerProfile?.must_change_password
    ) {
      return json({ error: 'Only authorized executive administrators can create administrative accounts.' }, 403, origin);
    }

    const draft = await request.json() as AdminDraft;
    const validationError = validateDraft(draft);
    if (validationError) {
      return json({ error: validationError }, 400, origin);
    }

    const actorRole = callerProfile.admin_role!;
    const requestedRole = draft.adminRole!;
    if (!canCreateAdminRole(actorRole, requestedRole)) {
      return json({ error: 'You cannot create an administrator at this hierarchy level.' }, 403, origin);
    }

    const username = draft.username!.trim().toLowerCase();
    const email = draft.email!.trim().toLowerCase();
    const displayName = draft.displayName!.trim();
    const phone = draft.phone?.trim() || null;

    const { data: createdUser, error: createError } =
      await serviceClient.auth.admin.createUser({
        email,
        password: draft.password!,
        email_confirm: true,
        user_metadata: {
          username,
          display_name: displayName,
          phone: phone ?? '',
          role: 'admin',
          admin_role: requestedRole
        }
      });

    if (createError || !createdUser.user) {
      const message = describeError(createError, 'Unable to create admin account.');
      console.error('admin-create-user: auth user creation failed', errorDetails(createError));
      return json({ error: message }, errorStatus(createError, 400), origin);
    }

    const profile = {
      id: createdUser.user.id,
      username,
      email,
      display_name: displayName,
      phone,
      role: 'admin',
      admin_role: requestedRole,
      status: 'active',
      must_change_password: true
    };

    const { data: savedProfile, error: profileError } = await serviceClient
      .from('profiles')
      .upsert(profile)
      .select('*')
      .single();

    if (profileError) {
      const message = describeError(profileError, 'Unable to save the administrative profile.');
      console.error('admin-create-user: profile upsert failed', errorDetails(profileError));
      const { error: rollbackError } =
        await serviceClient.auth.admin.deleteUser(createdUser.user.id);
      if (rollbackError) {
        console.error('admin-create-user: Auth rollback failed', errorDetails(rollbackError));
      }
      return json({ error: message }, 400, origin);
    }

    const { error: auditError } = await serviceClient.from('admin_audit_log').insert({
      actor_id: userData.user.id,
      target_id: createdUser.user.id,
      action: 'admin_account.created',
      details: { admin_role: requestedRole, actor_admin_role: actorRole }
    });
    if (auditError) console.error('admin-create-user: audit insert failed', errorDetails(auditError));

    return json({ profile: savedProfile }, 200, origin);
  } catch (error) {
    console.error('admin-create-user: unexpected failure', errorDetails(error));
    return json({ error: describeError(error, 'Unexpected server error.') }, 500, origin);
  }
});

function bearerAccessToken(authorization: string): string | null {
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}

function canCreateAdminRole(actorRole: string, targetRole: string): boolean {
  if (targetRole === 'default_admin' || !allowedAdminRoles.has(targetRole)) return false;
  if (actorRole === 'default_admin') return true;
  if (actorRole === 'ceo') return targetRole === 'director' || departmentAdminRoles.has(targetRole);
  if (actorRole === 'director') return departmentAdminRoles.has(targetRole);
  return false;
}

function allowedOrigin(request: Request): string | null {
  const requestOrigin = request.headers.get('Origin');
  if (!requestOrigin) return productionOrigin;

  const configuredOrigins = (Deno.env.get('EDUCAREER_ALLOWED_ORIGIN') ?? productionOrigin)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return configuredOrigins.includes(requestOrigin) || previewOriginPattern.test(requestOrigin)
    ? requestOrigin
    : null;
}

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

function errorStatus(error: unknown, fallback: number) {
  if (!error || typeof error !== 'object') return fallback;
  const status = (error as Record<string, unknown>).status;
  return typeof status === 'number' && status >= 400 && status <= 599 ? status : fallback;
}

function passwordMeetsPolicy(password: string): boolean {
  return (
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function validateDraft(draft: AdminDraft): string | null {
  if (!draft.username || draft.username.trim().length < 3) {
    return 'Username must contain at least 3 characters.';
  }
  if (!draft.password || !passwordMeetsPolicy(draft.password)) {
    return passwordPolicyMessage;
  }
  if (!draft.email || !draft.email.includes('@')) {
    return 'A valid email address is required.';
  }
  if (!draft.displayName || draft.displayName.trim().length < 2) {
    return 'Display name is required.';
  }
  if (!draft.adminRole || !allowedAdminRoles.has(draft.adminRole)) {
    return 'Invalid admin hierarchy.';
  }
  return null;
}

function json(payload: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
  });
}

function describeError(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim() && error.trim() !== '{}') return error.trim();
  if (error instanceof Error && error.message.trim() && error.message.trim() !== '{}') return error.message.trim();
  if (error && typeof error === 'object') {
    const candidate = error as Record<string, unknown>;
    for (const key of ['message', 'error_description', 'details', 'hint', 'code']) {
      const value = candidate[key];
      if (typeof value === 'string' && value.trim() && value.trim() !== '{}') return value.trim();
    }
  }
  return fallback;
}

function errorDetails(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object') return { value: String(error) };
  const candidate = error as Record<string, unknown>;
  return {
    name: candidate.name,
    message: candidate.message,
    status: candidate.status,
    code: candidate.code,
    details: candidate.details,
    hint: candidate.hint
  };
}
