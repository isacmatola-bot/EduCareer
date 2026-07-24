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
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });

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
          admin_role: adminRole
        }
      });

    if (createError || !createdUser.user) {
      const message = describeError(createError, 'Unable to create admin account.');
      console.error('admin-create-user: auth user creation failed', errorDetails(createError));
      return json({ error: message }, errorStatus(createError, 400));
    }

    const profile = {
      id: createdUser.user.id,
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
      const { error: rollbackError } =
        await serviceClient.auth.admin.deleteUser(createdUser.user.id);
      if (rollbackError) {
        console.error(
          'admin-create-user: Auth rollback failed',
          errorDetails(rollbackError)
        );
      }
      return json({ error: message }, 400);
    }

    return json({ profile: savedProfile }, 200);
  } catch (error) {
    console.error('admin-create-user: unexpected failure', errorDetails(error));
    return json({ error: describeError(error, 'Unexpected server error.') }, 500);
  }
});

function errorStatus(error: unknown, fallback: number) {
  if (!error || typeof error !== 'object') return fallback;
  const status = (error as Record<string, unknown>).status;
  return typeof status === 'number' && status >= 400 && status <= 599
    ? status
    : fallback;
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
