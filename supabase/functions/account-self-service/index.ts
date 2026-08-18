import { createClient } from 'npm:@supabase/supabase-js@2';

const productionOrigin = 'https://edu-career-chi.vercel.app';
const previewOriginPattern =
  /^https:\/\/edu-career-[a-z0-9-]+-2kgmcorp\.vercel\.app$/;

type UpdateRequest = {
  action?: 'update';
  patch?: {
    displayName?: string;
    phone?: string | null;
    email?: string;
    password?: string;
  };
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

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: 'Supabase function environment is incomplete.' }, 500, origin);
    }
    if (!authorization) return json({ error: 'Missing authorization header.' }, 401, origin);

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
    if (userError || !userData.user) return json({ error: 'Unauthorized request.' }, 401, origin);

    const body = await request.json() as UpdateRequest;
    if (body.action !== 'update') return json({ error: 'Invalid account operation.' }, 400, origin);

    const { data: currentProfile, error: profileReadError } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .single();
    if (profileReadError || !currentProfile) return json({ error: 'Account profile not found.' }, 404, origin);
    if (currentProfile.status === 'disabled' || currentProfile.status === 'rejected') {
      return json({ error: 'This account cannot be updated.' }, 403, origin);
    }

    const patch = body.patch ?? {};
    const profilePatch: Record<string, string | boolean | null> = {};
    const metadata: Record<string, string> = {
      display_name: currentProfile.display_name,
      phone: currentProfile.phone ?? '',
      role: currentProfile.role,
      admin_role: currentProfile.admin_role ?? ''
    };

    if (patch.displayName !== undefined) {
      const displayName = patch.displayName.trim();
      if (displayName.length < 2) return json({ error: 'Display name is required.' }, 400, origin);
      profilePatch.display_name = displayName;
      metadata.display_name = displayName;
    }
    if (patch.phone !== undefined) {
      profilePatch.phone = patch.phone?.trim() || null;
      metadata.phone = profilePatch.phone ?? '';
    }
    if (patch.password !== undefined && patch.password.length < 8) {
      return json({ error: 'Password must contain at least 8 characters.' }, 400, origin);
    }
    if (currentProfile.role === 'admin' && currentProfile.must_change_password) {
      const changesProfile = patch.displayName !== undefined || patch.phone !== undefined || patch.email !== undefined;
      if (!patch.password || changesProfile) {
        return json({ error: 'You must set a new password before accessing administrative features.' }, 400, origin);
      }
    }

    const mandatoryMfaRoles = new Set(['default_admin', 'ceo', 'director', 'it', 'support']);
    if (currentProfile.role === 'admin' && !currentProfile.must_change_password && mandatoryMfaRoles.has(currentProfile.admin_role)) {
      const { data: aalData, error: aalError } = await userClient.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError || aalData.currentLevel !== 'aal2') {
        return json({ error: 'Multi-factor authentication is required to change this administrative account.' }, 403, origin);
      }
    }

    const requestedEmail = patch.email?.trim().toLowerCase();
    const emailChanged = Boolean(requestedEmail && requestedEmail !== currentProfile.email);
    if (emailChanged && !requestedEmail?.includes('@')) {
      return json({ error: 'A valid email address is required.' }, 400, origin);
    }
    if (emailChanged) {
      const { data: emailOwner } = await serviceClient
        .from('profiles')
        .select('id')
        .eq('email', requestedEmail)
        .neq('id', userData.user.id)
        .maybeSingle();
      if (emailOwner) return json({ error: 'This email address is already registered.' }, 409, origin);
    }

    const authPatch: {
      email?: string;
      password?: string;
      data?: Record<string, string>;
    } = { data: metadata };
    if (emailChanged) authPatch.email = requestedEmail;
    if (patch.password) authPatch.password = patch.password;

    const authUpdateError = await updateAuthenticatedUser(
      supabaseUrl,
      anonKey,
      authorization,
      authPatch
    );
    if (authUpdateError) return json({ error: authUpdateError.message }, authUpdateError.status, origin);
    if (currentProfile.role === 'admin' && currentProfile.must_change_password && patch.password) {
      profilePatch.must_change_password = false;
    }

    let profile = currentProfile;
    if (Object.keys(profilePatch).length > 0) {
      const { data: updatedProfile, error: profileUpdateError } = await serviceClient
        .from('profiles')
        .update(profilePatch)
        .eq('id', userData.user.id)
        .select('*')
        .single();
      if (profileUpdateError) return json({ error: profileUpdateError.message }, 400, origin);
      profile = updatedProfile;
    }

    return json({
      profile,
      emailConfirmationRequired: emailChanged
    }, 200, origin);
  } catch (error) {
    console.error('account-self-service: unexpected failure', errorDetails(error));
    return json({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500, origin);
  }
});

function allowedOrigin(request: Request): string | null {
  const requestOrigin = request.headers.get('Origin');
  if (!requestOrigin) return productionOrigin;

  const configuredOrigins = (Deno.env.get('EDUCAREER_ALLOWED_ORIGIN') ?? productionOrigin)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return configuredOrigins.includes(requestOrigin) ||
    previewOriginPattern.test(requestOrigin)
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

function errorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const candidate = error as Error & Record<string, unknown>;
    return {
      name: error.name,
      message: error.message,
      status: candidate.status,
      code: candidate.code
    };
  }
  return { value: error };
}

async function updateAuthenticatedUser(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
  attributes: {
    email?: string;
    password?: string;
    data?: Record<string, string>;
  }
): Promise<{ message: string; status: number } | null> {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'Authorization': authorization,
      'apikey': anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(attributes)
  });

  if (response.ok) return null;

  let message = 'Unable to update authentication details.';
  try {
    const payload = await response.json() as {
      message?: unknown;
      msg?: unknown;
      error_description?: unknown;
    };
    const candidate = payload.message ?? payload.msg ?? payload.error_description;
    if (typeof candidate === 'string' && candidate.trim()) message = candidate.trim();
  } catch {
    // Keep the generic message when Auth does not return JSON.
  }

  return { message, status: response.status || 400 };
}

function json(payload: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
  });
}
