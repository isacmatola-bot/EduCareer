type ClientEvent = {
  kind?: string;
  message?: string;
  stack?: string;
  path?: string;
  online?: boolean;
  timestamp?: string;
};

type VercelRequest = AsyncIterable<Uint8Array | string> & {
  body?: ClientEvent | string;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

const allowedKinds = new Set([
  'frontend_error',
  'unhandled_rejection',
  'react_error',
  'supabase_unavailable',
  'supabase_recovered'
]);

export function scrubClientValue(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token]')
    .slice(0, maxLength);
}

function originMatchesHost(origin: string | undefined, host: string | undefined): boolean {
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function readBody(request: VercelRequest): Promise<ClientEvent> {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') return JSON.parse(request.body) as ClientEvent;

  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 12_000) throw new Error('payload_too_large');
  }
  return JSON.parse(body) as ClientEvent;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  const startedAt = Date.now();

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.statusCode = 405;
    response.end();
    return;
  }

  const origin = Array.isArray(request.headers.origin) ? request.headers.origin[0] : request.headers.origin;
  const host = Array.isArray(request.headers.host) ? request.headers.host[0] : request.headers.host;
  if (!originMatchesHost(origin, host) || request.headers['sec-fetch-site'] === 'cross-site') {
    response.statusCode = 403;
    response.end();
    return;
  }

  if (Number(request.headers['content-length'] ?? 0) > 12_000) {
    response.statusCode = 413;
    response.end();
    return;
  }

  let event: ClientEvent;
  try {
    event = await readBody(request);
  } catch (error) {
    response.statusCode = error instanceof Error && error.message === 'payload_too_large' ? 413 : 400;
    response.end();
    return;
  }

  if (!event.kind || !allowedKinds.has(event.kind)) {
    response.statusCode = 400;
    response.end();
    return;
  }

  const logEntry = {
    level: event.kind === 'supabase_recovered' ? 'info' : 'error',
    message: 'educareer_client_event',
    kind: event.kind,
    clientMessage: scrubClientValue(event.message, 1_000),
    stack: scrubClientValue(event.stack, 4_000),
    path: scrubClientValue(event.path, 500),
    online: event.online,
    timestamp: scrubClientValue(event.timestamp, 50),
    requestId: request.headers['x-vercel-id'],
    durationMs: Date.now() - startedAt
  };

  if (event.kind === 'supabase_recovered') console.info(JSON.stringify(logEntry));
  else console.error(JSON.stringify(logEntry));

  response.statusCode = 202;
  response.end();
}
