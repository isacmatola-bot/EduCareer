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

  // A recovery session is temporary. End it after the password change so the
  // user must authenticate normally again (and complete MFA when required).
  await client.auth.signOut();
}
