import { supabase } from './supabaseClient';

export type ClientEventKind =
  | 'frontend_error'
  | 'unhandled_rejection'
  | 'react_error'
  | 'supabase_unavailable'
  | 'supabase_recovered';

type ClientEvent = {
  kind: ClientEventKind;
  message: string;
  stack?: string;
};

export function reportClientEvent(event: ClientEvent): void {
  const payload = JSON.stringify({
    ...event,
    path: window.location.pathname,
    online: navigator.onLine,
    timestamp: new Date().toISOString()
  });

  if (navigator.sendBeacon?.('/api/client-error', new Blob([payload], { type: 'application/json' }))) return;

  void fetch('/api/client-error', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
    keepalive: true,
    credentials: 'same-origin'
  }).catch(() => undefined);
}

export function installGlobalErrorMonitoring(): () => void {
  const handleError = (event: ErrorEvent) => reportClientEvent({
    kind: 'frontend_error',
    message: event.message || 'Unknown frontend error',
    stack: event.error instanceof Error ? event.error.stack : undefined
  });

  const handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    reportClientEvent({
      kind: 'unhandled_rejection',
      message: reason instanceof Error ? reason.message : String(reason ?? 'Unknown rejected promise'),
      stack: reason instanceof Error ? reason.stack : undefined
    });
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);
  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleRejection);
  };
}

export function monitorSupabaseAvailability(onChange: (available: boolean) => void): () => void {
  if (!supabase) return () => undefined;
  const client = supabase;

  let stopped = false;
  let lastAvailable: boolean | undefined;
  let timer: number | undefined;

  const check = async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    let available = false;

    try {
      const { error } = await client.from('programs').select('id').limit(1).abortSignal(controller.signal);
      available = !error;
    } catch {
      available = false;
    } finally {
      window.clearTimeout(timeout);
    }

    if (stopped) return;
    onChange(available);

    if (lastAvailable !== undefined && available !== lastAvailable) {
      reportClientEvent({
        kind: available ? 'supabase_recovered' : 'supabase_unavailable',
        message: available ? 'Supabase connectivity recovered' : 'Supabase health check failed'
      });
    } else if (lastAvailable === undefined && !available) {
      reportClientEvent({ kind: 'supabase_unavailable', message: 'Initial Supabase health check failed' });
    }

    lastAvailable = available;
    timer = window.setTimeout(check, 60_000);
  };

  const handleOnline = () => void check();
  window.addEventListener('online', handleOnline);
  void check();

  return () => {
    stopped = true;
    if (timer !== undefined) window.clearTimeout(timer);
    window.removeEventListener('online', handleOnline);
  };
}
