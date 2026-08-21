import {
  createClient,
  type SupabaseClient
} from 'npm:@supabase/supabase-js@2';

const productionOrigin = 'https://edu-career-chi.vercel.app';
const previewOriginPattern =
  /^https:\/\/edu-career-[a-z0-9-]+-2kgmcorp\.vercel\.app$/;

const accountManagerRoles = new Set(['default_admin', 'ceo', 'director', 'it', 'support']);
const governanceRoles = new Set(['default_admin', 'ceo', 'director']);
const departmentAdminRoles = new Set([
  'it', 'rh', 'finance', 'programs', 'opportunities', 'partnerships', 'support', 'statistics'
]);
const adminRoles = new Set([
  'default_admin', 'ceo', 'director', ...departmentAdminRoles
]);

type ManageRequest = {
  action?: 'update' | 'delete';
  accountId?: string;
  patch?: {
    displayName?: string;
    email?: string;
    phone?: string | null;
    status?: 'active' | 'pending' | 'rejected' | 'disabled';
    adminRole?: string | null;
  };
};

type Profile = Record<string, string | boolean | null> & {
  id: string;
  role: string;
  admin_role: string | null;
  status: string;
  must_change_password: boolean;
};

Deno.serve(async (request) => {
  const origin = allowedOrigin(request);
  if (!origin) return json({ error: 'Origin not allowed.' }, 403, productionOrigin);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey =
      Deno.env.get('EDUCAREER_SECRET_KEY') ??
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Supabase function environment is incomplete.' }, 500, origin);
    if (!authorization) return json({ error: 'Missing authorization header.' }, 401, origin);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Unauthorized request.' }, 401, origin);
    const { data: aalData, error: aalError } = await userClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError || aalData.currentLevel !== 'aal2') {
      return json({ error: 'Multi-factor authentication is required for account management.' }, 403, origin);
    }

    const body = await request.json() as ManageRequest;
    if (!body.accountId || !body.action) return json({ error: 'Invalid account operation.' }, 400, origin);

    const [{ data: caller }, { data: target }] = await Promise.all([
      serviceClient.from('profiles').select('id, role, admin_role, status, must_change_password').eq('id', userData.user.id).single(),
      serviceClient.from('profiles').select('*').eq('id', body.accountId).single()
    ]);

    if (!isUsableAccountManager(caller as Profile | null)) {
      return json({ error: 'You do not have permission to manage accounts.' }, 403, origin);
    }
    if (!target) return json({ error: 'Account not found.' }, 404, origin);

    const callerProfile = caller as Profile;
    const targetProfile = target as Profile;
    const actorRole = callerProfile.admin_role!;
    const targetIsAdmin = targetProfile.role === 'admin';

    if (targetProfile.id === callerProfile.id && targetIsAdmin) {
      return json({ error: 'Administrative self-management must use the account self-service flow.' }, 400, origin);
    }
    if (targetProfile.admin_role === 'default_admin') {
      return json({ error: 'The default admin account is protected.' }, 400, origin);
    }
    if (targetIsAdmin && !canManageAdminRole(actorRole, targetProfile.admin_role)) {
      return json({ error: 'You cannot manage an administrator at this hierarchy level.' }, 403, origin);
    }

    if (body.action === 'delete') {
      if (!governanceRoles.has(actorRole)) {
        return json({ error: 'Only executive administrators can delete accounts.' }, 403, origin);
      }
      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(targetProfile.id);
      if (deleteError) {
        console.error('admin-manage-user: Auth deletion failed', errorDetails(deleteError));
        return json({ error: describeError(deleteError, 'Unable to delete this account.') }, errorStatus(deleteError, 400), origin);
      }
      await writeAuditLog(serviceClient, callerProfile.id, targetProfile.id, 'account.deleted', {
        role: targetProfile.role,
        admin_role: targetProfile.admin_role,
        actor_admin_role: actorRole
      });
      return json({ success: true }, 200, origin);
    }

    const patch = body.patch ?? {};
    const profilePatch: Record<string, string | null> = {};
    const authPatch: { email?: string; email_confirm?: boolean; user_metadata?: Record<string, string> } = {};

    if (patch.displayName !== undefined) {
      const displayName = patch.displayName.trim();
      if (displayName.length < 2) return json({ error: 'Display name is required.' }, 400, origin);
      profilePatch.display_name = displayName;
    }
    if (patch.email !== undefined) {
      const email = patch.email.trim().toLowerCase();
      if (!email.includes('@')) return json({ error: 'A valid email address is required.' }, 400, origin);
      const { data: emailOwner } = await serviceClient
        .from('profiles').select('id').eq('email', email).neq('id', targetProfile.id).maybeSingle();
      if (emailOwner) return json({ error: 'This email address is already registered.' }, 409, origin);
      profilePatch.email = email;
      authPatch.email = email;
      authPatch.email_confirm = true;
    }
    if (patch.phone !== undefined) profilePatch.phone = patch.phone?.trim() || null;
    if (patch.status !== undefined) {
      if (!['active', 'pending', 'rejected', 'disabled'].includes(patch.status)) return json({ error: 'Invalid account status.' }, 400, origin);
      profilePatch.status = patch.status;
    }
    if (patch.adminRole !== undefined && targetIsAdmin) {
      if (!governanceRoles.has(actorRole)) {
        return json({ error: 'Only executive administrators can change administrative roles.' }, 403, origin);
      }
      if (!patch.adminRole || !adminRoles.has(patch.adminRole) || patch.adminRole === 'default_admin') {
        return json({ error: 'The default admin role cannot be assigned.' }, 400, origin);
      }
      if (!canAssignAdminRole(actorRole, patch.adminRole)) {
        return json({ error: 'You cannot assign an administrator to this hierarchy level.' }, 403, origin);
      }
      profilePatch.admin_role = patch.adminRole;
    }

    authPatch.user_metadata = {
      display_name: profilePatch.display_name ?? String(targetProfile.display_name ?? ''),
      phone: profilePatch.phone ?? String(targetProfile.phone ?? ''),
      role: targetProfile.role,
      admin_role: profilePatch.admin_role ?? targetProfile.admin_role ?? ''
    };

    const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(targetProfile.id, authPatch);
    if (authUpdateError) {
      console.error('admin-manage-user: Auth update failed', errorDetails(authUpdateError));
      return json({ error: describeError(authUpdateError, 'Unable to update this account.') }, errorStatus(authUpdateError, 400), origin);
    }

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles').update(profilePatch).eq('id', targetProfile.id).select('*').single();
    if (profileError) {
      console.error('admin-manage-user: profile update failed', errorDetails(profileError));
      await rollbackAuthUpdate(serviceClient, targetProfile);
      return json({ error: describeError(profileError, 'Unable to save this account profile.') }, 400, origin);
    }
    await writeAuditLog(serviceClient, callerProfile.id, targetProfile.id, 'account.updated', {
      fields: Object.keys(profilePatch),
      target_role: targetProfile.role,
      target_admin_role: targetProfile.admin_role,
      resulting_admin_role: profilePatch.admin_role ?? targetProfile.admin_role,
      actor_admin_role: actorRole
    });
    return json({ profile }, 200, origin);
  } catch (error) {
    console.error('admin-manage-user: unexpected failure', errorDetails(error));
    return json({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500, origin);
  }
});

function isUsableAccountManager(caller: Profile | null): boolean {
  return Boolean(
    caller &&
    caller.role === 'admin' &&
    caller.status === 'active' &&
    !caller.must_change_password &&
    caller.admin_role &&
    accountManagerRoles.has(caller.admin_role)
  );
}

function canManageAdminRole(actorRole: string, targetRole: string | null): boolean {
  if (!targetRole || targetRole === 'default_admin' || actorRole === targetRole) return false;
  if (actorRole === 'default_admin') return true;
  if (actorRole === 'ceo') return targetRole === 'director' || departmentAdminRoles.has(targetRole);
  if (actorRole === 'director') return departmentAdminRoles.has(targetRole);
  return false;
}

function canAssignAdminRole(actorRole: string, targetRole: string): boolean {
  if (targetRole === 'default_admin') return false;
  if (actorRole === 'default_admin') return targetRole === 'ceo' || targetRole === 'director' || departmentAdminRoles.has(targetRole);
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

async function rollbackAuthUpdate(
  serviceClient: SupabaseClient,
  target: Profile
) {
  const { error } = await serviceClient.auth.admin.updateUserById(
    target.id,
    {
      email: String(target.email ?? ''),
      email_confirm: true,
      user_metadata: {
        display_name: String(target.display_name ?? ''),
        phone: String(target.phone ?? ''),
        role: target.role,
        admin_role: target.admin_role ?? ''
      }
    }
  );
  if (error) console.error('admin-manage-user: Auth rollback failed', errorDetails(error));
}

async function writeAuditLog(
  serviceClient: SupabaseClient,
  actorId: string,
  targetId: string,
  action: string,
  details: Record<string, unknown>
) {
  const { error } = await serviceClient.from('admin_audit_log').insert({
    actor_id: actorId,
    target_id: targetId,
    action,
    details
  });
  if (error) console.error('admin-manage-user: audit insert failed', errorDetails(error));
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message && error.message !== '{}') return error.message;
  if (error && typeof error === 'object') {
    const candidate = error as Record<string, unknown>;
    for (const key of ['message', 'msg', 'error_description', 'error']) {
      const value = candidate[key];
      if (typeof value === 'string' && value && value !== '{}') return value;
    }
  }
  return fallback;
}

function errorStatus(error: unknown, fallback: number): number {
  if (error && typeof error === 'object') {
    const status = (error as Record<string, unknown>).status;
    if (typeof status === 'number' && status >= 400 && status <= 599) return status;
  }
  return fallback;
}

function errorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const candidate = error as Error & Record<string, unknown>;
    return {
      name: error.name,
      message: error.message,
      status: candidate.status,
      code: candidate.code,
      details: candidate.details
    };
  }
  return { value: error };
}

function json(payload: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
  });
}
