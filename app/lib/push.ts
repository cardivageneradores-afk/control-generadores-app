export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  usuario_email: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface PushSendSummary {
  attempted: number;
  sent: number;
  removed: number;
  failed: number;
}

// Sin las tres variables (o con valores inválidos) las notificaciones quedan desactivadas, sin error.
export function getPushConfig(env: Record<string, string | undefined>): PushConfig | null {
  const publicKey = (env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? env.VAPID_PUBLIC_KEY ?? '').trim();
  const privateKey = (env.VAPID_PRIVATE_KEY ?? '').trim();
  const subject = (env.VAPID_SUBJECT ?? '').trim();
  if (!publicKey || !privateKey || !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(subject)) return null;
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(publicKey) || !/^[A-Za-z0-9_-]{40,50}$/.test(privateKey)) return null;
  return { publicKey, privateKey, subject };
}

export function isValidSubscriptionInput(value: unknown): value is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (!value || typeof value !== 'object') return false;
  const { endpoint, keys } = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return false;
  try {
    if (new URL(endpoint).protocol !== 'https:') return false;
  } catch {
    return false;
  }
  return (
    typeof keys?.p256dh === 'string' && /^[A-Za-z0-9_-]{20,200}$/.test(keys.p256dh) &&
    typeof keys?.auth === 'string' && /^[A-Za-z0-9_-]{10,64}$/.test(keys.auth)
  );
}

const MADRID_FORMAT = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function buildCompletionPayload(input: {
  movementId: string;
  generatorCode: string;
  action: 'entregado' | 'recogido';
  origin: string;
  destination: string;
  completedBy: string;
  now: Date;
  note?: string | null;
}): PushPayload {
  const place = (input.action === 'entregado' ? input.destination : input.origin).trim() || 'ubicación sin indicar';
  return {
    title: `Generador ${input.generatorCode} ${input.action} en ${place}`.slice(0, 120),
    body: [
      `Marcado por ${input.completedBy} · ${MADRID_FORMAT.format(input.now)}`,
      input.note?.trim() ? `Nota: ${input.note.trim().replace(/\s+/g, ' ')}` : '',
    ].filter(Boolean).join('\n').slice(0, 300),
    url: '/',
    tag: `movimiento-${input.movementId}`,
  };
}

// Editores a notificar: rol efectivo editor (leído de la base) y distinto de quien completó.
export function selectEditorEmails(users: { email: string; rol: string }[], actorEmail: string) {
  const actor = actorEmail.trim().toLowerCase();
  const emails = users
    .filter((user) => user.rol === 'editor' && user.email.trim().toLowerCase() !== actor)
    .map((user) => user.email.trim().toLowerCase());
  return Array.from(new Set(emails));
}

export type PushSender = (subscription: StoredSubscription, payload: string) => Promise<unknown>;

export function isExpiredSubscriptionError(error: unknown) {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return status === 404 || status === 410;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('push_timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Best-effort: nunca lanza; limpia suscripciones caducadas (404/410); no registra claves ni endpoints.
export async function deliverPush(options: {
  subscriptions: StoredSubscription[];
  payload: PushPayload;
  send: PushSender;
  removeExpired: (endpoints: string[]) => Promise<void>;
  timeoutMs?: number;
}): Promise<PushSendSummary> {
  const summary: PushSendSummary = { attempted: options.subscriptions.length, sent: 0, removed: 0, failed: 0 };
  const body = JSON.stringify(options.payload);
  const expired: string[] = [];
  await Promise.all(
    options.subscriptions.map(async (subscription) => {
      try {
        await withTimeout(Promise.resolve().then(() => options.send(subscription, body)), options.timeoutMs ?? 5000);
        summary.sent += 1;
      } catch (error) {
        if (isExpiredSubscriptionError(error)) expired.push(subscription.endpoint);
        else summary.failed += 1;
      }
    }),
  );
  if (expired.length) {
    try {
      await options.removeExpired(expired);
      summary.removed = expired.length;
    } catch {
      summary.failed += expired.length;
    }
  }
  return summary;
}
