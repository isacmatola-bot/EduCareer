import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

if (supabase && supabaseAnonKey) {
  const configuredSupabase = supabase;
  const fallbackToken = supabaseAnonKey;

  function syncFunctionsAuth(accessToken?: string | null) {
    configuredSupabase.functions.setAuth(accessToken ?? fallbackToken);
  }

  void configuredSupabase.auth.getSession()
    .then(({ data }) => syncFunctionsAuth(data.session?.access_token))
    .catch(() => syncFunctionsAuth(null));

  configuredSupabase.auth.onAuthStateChange((_event, session) => {
    syncFunctionsAuth(session?.access_token);
  });
}

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  return supabase;
}
