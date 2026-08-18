type HealthResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

type RuntimeEnvironment = { process?: { env?: Record<string, string | undefined> } };

export default async function handler(
  request: { method?: string },
  response: HealthResponse
): Promise<void> {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.statusCode = 405;
    response.end(JSON.stringify({ status: 'method_not_allowed' }));
    return;
  }

  const env = (globalThis as RuntimeEnvironment).process?.env ?? {};
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    response.statusCode = 503;
    response.end(JSON.stringify({ status: 'unhealthy', dependency: 'supabase', reason: 'configuration' }));
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const check = await fetch(`${supabaseUrl}/rest/v1/programs?select=id&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: controller.signal
    });
    response.statusCode = check.ok ? 200 : 503;
    response.end(JSON.stringify({
      status: check.ok ? 'healthy' : 'unhealthy',
      dependency: 'supabase',
      checkedAt: new Date().toISOString()
    }));
  } catch {
    response.statusCode = 503;
    response.end(JSON.stringify({ status: 'unhealthy', dependency: 'supabase', checkedAt: new Date().toISOString() }));
  } finally {
    clearTimeout(timeout);
  }
}
