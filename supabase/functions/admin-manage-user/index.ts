import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const operationalRoles = new Set(['default_admin', 'ceo', 'director', 'it']);
const adminRoles = new Set([
  'default_admin', 'ceo', 'director', 'it', 'rh', 'finance', 'programs',
  'opportunities', 'partnerships', 'support', 'statistics'
]);

type ManageRequest = {
  action?: 'update' | 'delete';
  accountId?: string;
  patch?: {
    displayName?: string;
    email?: string;
    phone?: string | null;
    status?: 'active' | 'pending' | 'disabled';
    adminRole?: string | null;
  };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey =
      Deno.env.get('EDUCAREER_SECRET_KEY') ??
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Supabase function environment is incomplete.' }, 500);
    if (!authorization) return json({ error: 'Missing authorization header.' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Unauthorized request.' }, 401);

    const body = await request.json() as ManageRequest;
    if (!body.accountId || !body.action) return json({ error: 'Invalid account operation.' }, 400);

    const [{ data: caller }, { data: target }] = await Promise.all([
      serviceClient.from('profiles').select('id, role, admin_role, status').eq('id', userData.user.id).single(),
      serviceClient.from('profiles').select('*').eq('id', body.accountId).single()
    ]);

    if (!caller || caller.role !== 'admin' || caller.status !== 'active' || !operationalRoles.has(caller.admin_role)) {
      return json({ error: 'You do not have permission to manage accounts.' }, 403);
    }
    if (!target) return json({ error: 'Account not found.' }, 404);

    const isDefaultAdmin = caller.admin_role === 'default_admin';
    const targetIsAdmin = target.role === 'admin';
    if (targetIsAdmin && !isDefaultAdmin) return json({ error: 'Only the default admin can manage administrative accounts.' }, 403);

    if (body.action === 'delete') {
      if (!isDefaultAdmin) return json({ error: 'Only the default admin can delete accounts.' }, 403);
      if (target.id === caller.id || target.admin_role === 'default_admin') return json({ error: 'The default admin account cannot be deleted.' }, 400);
      try {
        await authAdminRequest(supabaseUrl, serviceRoleKey, target.id, 'DELETE');
      } catch (error) {
        console.error('admin-manage-user: Auth deletion failed', errorDetails(error));
        return json({ error: describeError(error, 'Unable to delete this account.') }, errorStatus(error, 400));
      }
      return json({ success: true }, 200);
    }

    const patch = body.patch ?? {};
    const profilePatch: Record<string, string | null> = {};
    const authPatch: { email?: string; email_confirm?: boolean; user_metadata?: Record<string, string> } = {};

    if (patch.displayName !== undefined) {
      const displayName = patch.displayName.trim();
      if (displayName.length < 2) return json({ error: 'Display name is required.' }, 400);
      profilePatch.display_name = displayName;
    }
    if (patch.email !== undefined) {
      const email = patch.email.trim().toLowerCase();
      if (!email.includes('@')) return json({ error: 'A valid email address is required.' }, 400);
      const { data: emailOwner } = await serviceClient
        .from('profiles').select('id').eq('email', email).neq('id', target.id).maybeSingle();
      if (emailOwner) return json({ error: 'This email address is already registered.' }, 409);
      profilePatch.email = email;
      authPatch.email = email;
      authPatch.email_confirm = true;
    }
    if (patch.phone !== undefined) profilePatch.phone = patch.phone?.trim() || null;
    if (patch.status !== undefined) {
      if (!['active', 'pending', 'disabled'].includes(patch.status)) return json({ error: 'Invalid account status.' }, 400);
      if (target.admin_role === 'default_admin' && patch.status !== 'active') return json({ error: 'The default admin must remain active.' }, 400);
      profilePatch.status = patch.status;
    }
    if (patch.adminRole !== undefined && targetIsAdmin) {
      if (!patch.adminRole || !adminRoles.has(patch.adminRole)) return json({ error: 'Invalid admin hierarchy.' }, 400);
      if (target.admin_role === 'default_admin' && patch.adminRole !== 'default_admin') return json({ error: 'The default admin hierarchy cannot be changed.' }, 400);
      profilePatch.admin_role = patch.adminRole;
    }

    authPatch.user_metadata = {
      display_name: profilePatch.display_name ?? target.display_name,
      phone: profilePatch.phone ?? target.phone ?? '',
      role: target.role,
      admin_role: profilePatch.admin_role ?? target.admin_role ?? ''
    };

    try {
      await authAdminRequest(supabaseUrl, serviceRoleKey, target.id, 'PUT', authPatch);
    } catch (error) {
      console.error('admin-manage-user: Auth update failed', errorDetails(error));
      return json({ error: describeError(error, 'Unable to update this account.') }, errorStatus(error, 400));
    }

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles').update(profilePatch).eq('id', target.id).select('*').single();
    if (profileError) {
      console.error('admin-manage-user: profile update failed', errorDetails(profileError));
      await rollbackAuthUpdate(supabaseUrl, serviceRoleKey, target);
      return json({ error: describeError(profileError, 'Unable to save this account profile.') }, 400);
    }
    return json({ profile }, 200);
  } catch (error) {
    console.error('admin-manage-user: unexpected failure', errorDetails(error));
    return json({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500);
  }
});

async function authAdminRequest(
  supabaseUrl: string,
  secretKey: string,
  userId: string,
  method: 'PUT' | 'DELETE',
  payload?: Record<string, unknown>
): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method,
        headers: {
          apikey: secretKey,
          ...(payload ? { 'Content-Type': 'application/json' } : {})
        },
        body: payload ? JSON.stringify(payload) : undefined
      });
      const body = await readJson(response);
      if (response.ok) return body;

      const error = authResponseError(response.status, body);
      if (!isRetryableStatus(response.status)) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === 3) throw error;
    }

    console.warn(`admin-manage-user: retrying Auth request (${attempt}/3)`);
    await delay(attempt * 400);
  }

  throw lastError ?? new Error('Supabase Auth is temporarily unavailable.');
}

async function rollbackAuthUpdate(
  supabaseUrl: string,
  secretKey: string,
  target: Record<string, string | null>
) {
  try {
    await authAdminRequest(supabaseUrl, secretKey, target.id, 'PUT', {
      email: target.email,
      email_confirm: true,
      user_metadata: {
        display_name: target.display_name,
        phone: target.phone ?? '',
        role: target.role,
        admin_role: target.admin_role ?? ''
      }
    });
  } catch (error) {
    console.error('admin-manage-user: Auth rollback failed', errorDetails(error));
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function authResponseError(status: number, body: unknown): Error {
  const error = new Error(describeError(body, `Supabase Auth request failed (${status}).`));
  Object.assign(error, { status, details: body });
  return error;
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

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as Record<string, unknown>).status;
    if (typeof status === 'number') return isRetryableStatus(status);
  }
  return error instanceof TypeError;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
