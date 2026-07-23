import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

type AdminDraft = {
  username?: string;
  password?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  adminRole?: string;
};

type AuthUser = {
  id: string;
  email?: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey =
      Deno.env.get('EDUCAREER_SECRET_KEY') ??
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: 'Supabase function environment is incomplete.' }, 500);
    }

    const authorization = request.headers.get('Authorization');
    if (!authorization) {
      return json({ error: 'Missing authorization header.' }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } }
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: 'Unauthorized request.' }, 401);
    }

    const { data: callerProfile, error: callerError } = await serviceClient
      .from('profiles')
      .select('role, admin_role, status')
      .eq('id', userData.user.id)
      .single();

    if (
      callerError ||
      callerProfile?.role !== 'admin' ||
      callerProfile?.admin_role !== 'default_admin' ||
      callerProfile?.status !== 'active'
    ) {
      return json({ error: 'Only the default admin can create administrative accounts.' }, 403);
    }

    const draft = await request.json() as AdminDraft;
    const validationError = validateDraft(draft);
    if (validationError) {
      return json({ error: validationError }, 400);
    }

    const username = draft.username!.trim().toLowerCase();
    const email = draft.email!.trim().toLowerCase();
    const displayName = draft.displayName!.trim();
    const phone = draft.phone?.trim() || null;
    const adminRole = draft.adminRole!;

    let createdUser: AuthUser;
    try {
      createdUser = await createAuthUser(supabaseUrl, serviceRoleKey, {
        email,
        password: draft.password!,
        email_confirm: true,
        user_metadata: {
          username,
          display_name: displayName,
          phone: phone ?? '',
          role: 'admin',
          admin_role: adminRole
        }
      });
    } catch (createError) {
      const message = describeError(createError, 'Unable to create admin account.');
      console.error('admin-create-user: auth user creation failed', errorDetails(createError));
      return json({ error: message }, errorStatus(createError, 400));
    }

    const profile = {
      id: createdUser.id,
      username,
      email,
      display_name: displayName,
      phone,
      role: 'admin',
      admin_role: adminRole,
      status: 'active'
    };

    const { data: savedProfile, error: profileError } = await serviceClient
      .from('profiles')
      .upsert(profile)
      .select('*')
      .single();

    if (profileError) {
      const message = describeError(profileError, 'Unable to save the administrative profile.');
      console.error('admin-create-user: profile upsert failed', errorDetails(profileError));
      await deleteAuthUser(supabaseUrl, serviceRoleKey, createdUser.id);
      return json({ error: message }, 400);
    }

    return json({ profile: savedProfile }, 200);
  } catch (error) {
    console.error('admin-create-user: unexpected failure', errorDetails(error));
    return json({ error: describeError(error, 'Unexpected server error.') }, 500);
  }
});

async function createAuthUser(
  supabaseUrl: string,
  secretKey: string,
  payload: Record<string, unknown>
): Promise<AuthUser> {
  const email = typeof payload.email === 'string' ? payload.email : '';
  const existingUser = await findAuthUserByEmail(supabaseUrl, secretKey, email);
  if (existingUser) {
    throw authResponseError(422, {
      code: 'email_exists',
      message: 'An account with this email already exists.'
    });
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          apikey: secretKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const body = await readJson(response);

      if (response.ok && isAuthUser(body)) return body;

      const error = authResponseError(response.status, body);
      if (!isRetryableStatus(response.status)) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === 3) throw error;
    }

    const recoveredUser = await findAuthUserByEmail(supabaseUrl, secretKey, email);
    if (recoveredUser) return recoveredUser;

    console.warn(`admin-create-user: retrying Auth request (${attempt}/3)`);
    await delay(attempt * 400);
  }

  throw lastError ?? new Error('Supabase Auth is temporarily unavailable.');
}

async function findAuthUserByEmail(
  supabaseUrl: string,
  secretKey: string,
  email: string
): Promise<AuthUser | null> {
  if (!email) return null;

  try {
    for (let page = 1; page <= 10; page += 1) {
      const response = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=1000`,
        { headers: { apikey: secretKey } }
      );
      if (!response.ok) return null;

      const body = await readJson(response);
      const users = body && typeof body === 'object'
        ? (body as Record<string, unknown>).users
        : null;
      if (!Array.isArray(users)) return null;

      const match = users.find((user) =>
        isAuthUser(user) &&
        typeof user.email === 'string' &&
        user.email.toLowerCase() === email.toLowerCase()
      );
      if (isAuthUser(match)) return match;
      if (users.length < 1000) return null;
    }
  } catch (error) {
    console.warn('admin-create-user: unable to verify existing Auth user', errorDetails(error));
  }

  return null;
}

async function deleteAuthUser(supabaseUrl: string, secretKey: string, userId: string) {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: secretKey }
    });
    if (!response.ok) {
      console.error('admin-create-user: rollback failed', {
        status: response.status,
        body: await readJson(response)
      });
    }
  } catch (error) {
    console.error('admin-create-user: rollback failed', errorDetails(error));
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

function isAuthUser(value: unknown): value is AuthUser {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).id === 'string'
  );
}

function authResponseError(status: number, body: unknown): Error {
  const error = new Error(describeError(body, `Supabase Auth request failed (${status}).`));
  Object.assign(error, {
    status,
    code: body && typeof body === 'object'
      ? (body as Record<string, unknown>).code
      : undefined,
    details: body
  });
  return error;
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableError(error: unknown) {
  if (error instanceof TypeError) return true;
  if (!error || typeof error !== 'object') return false;
  const candidate = error as Record<string, unknown>;
  return candidate.name === 'AuthRetryableFetchError' ||
    (typeof candidate.status === 'number' && isRetryableStatus(candidate.status));
}

function errorStatus(error: unknown, fallback: number) {
  if (!error || typeof error !== 'object') return fallback;
  const status = (error as Record<string, unknown>).status;
  return typeof status === 'number' && status >= 400 && status <= 599
    ? status
    : fallback;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function validateDraft(draft: AdminDraft): string | null {
  if (!draft.username || draft.username.trim().length < 3) {
    return 'Username must contain at least 3 characters.';
  }

  if (!draft.password || draft.password.length < 8) {
    return 'Password must contain at least 8 characters.';
  }

  if (!draft.email || !draft.email.includes('@')) {
    return 'A valid email address is required.';
  }

  if (!draft.displayName || draft.displayName.trim().length < 2) {
    return 'Display name is required.';
  }

  const allowedAdminRoles = new Set([
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
  ]);

  if (!draft.adminRole || !allowedAdminRoles.has(draft.adminRole)) {
    return 'Invalid admin hierarchy.';
  }

  return null;
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
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
