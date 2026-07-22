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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
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
      const { error } = await serviceClient.auth.admin.deleteUser(target.id);
      if (error) return json({ error: error.message }, 400);
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

    const { error: authError } = await serviceClient.auth.admin.updateUserById(target.id, authPatch);
    if (authError) return json({ error: authError.message }, 400);

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles').update(profilePatch).eq('id', target.id).select('*').single();
    if (profileError) return json({ error: profileError.message }, 400);
    return json({ profile }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
