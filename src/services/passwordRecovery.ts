import { requireSupabase } from './supabaseClient';

function normalizeLogin(value: string): string {
  return value.trim().toLowerCase();
}

export async function requestPasswordRecovery(identifier: string): Promise<void> {
  const client = requireSupabase();
  const normalized = normalizeLogin(identifier);

  if (!normalized) {
    throw new Error('A username or email address is required.');
  }

  let email = normalized;

  if (!normalized.includes('@')) {
    const { data, error } = await client.rpc('get_login_email', {
      login_username: normalized
    });

    // Keep the public response intentionally non-enumerating. Unknown usernames
    // follow the same successful UI path as known accounts.
    if (error || typeof data !== 'string' || !data.includes('@')) {
      return;
    }

    email = data.trim().toLowerCase();
  }

  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });

  if (error) {
    throw new Error('Password recovery is temporarily unavailable. Please try again later.');
  }
}

export function subscribeToPasswordRecovery(onRecovery: () => void): () => void {
  const client = requireSupabase();
  const { data } = client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      onRecovery();
    }
  });

  return () => data.subscription.unsubscribe();
}

export async function completePasswordRecovery(password: string): Promise<void> {
  if (password.length < 8) {
    throw new Error('Password must contain at least 8 characters.');
  }

  const client = requireSupabase();
  const { error } = await client.auth.updateUser({ password });

  if (error) {
    throw new Error('Unable to update the password. Request a new recovery link and try again.');
  }

  // If this recovery replaces an administrator's temporary first-login
  // password, let the existing self-service function clear the mandatory
  // password-change flag. Established admins skip this path and retain MFA.
  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  const { data: profile } = userId
    ? await client
        .from('profiles')
        .select('role,must_change_password')
        .eq('id', userId)
        .maybeSingle()
    : { data: null };

  if (profile?.role === 'admin' && profile.must_change_password) {
    const { data: functionData, error: functionError } = await client.functions.invoke('account-self-service', {
      body: { action: 'update', patch: { password } }
    });
    const payload = functionData as { error?: string } | null;

    if (functionError || payload?.error) {
      throw new Error('The password was changed, but the administrative first-login reset could not be completed. Contact EduCareer support.');
    }
  }

  // A recovery session is temporary. End it after the password change so the
  // user must authenticate normally again (and complete MFA when required).
  await client.auth.signOut();
}
