import 'server-only';
import webpush from 'web-push';
import { supabaseAdmin } from './supabase';
import { deliverPush, getPushConfig, type PushPayload, type StoredSubscription } from './push';

const TABLE = 'push_subscriptions';

export function pushEnabled() {
  return getPushConfig(process.env) !== null && Boolean(supabaseAdmin);
}

export async function saveSubscription(input: { email: string; endpoint: string; p256dh: string; auth: string; userAgent: string | null }) {
  if (!supabaseAdmin) throw new Error('push_storage_unavailable');
  const { error } = await supabaseAdmin.from(TABLE).upsert(
    {
      usuario_email: input.email.toLowerCase(),
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error('push_storage_error');
}

export async function removeSubscriptions(endpoints: string[], email?: string) {
  if (!supabaseAdmin || !endpoints.length) return;
  let query = supabaseAdmin.from(TABLE).delete().in('endpoint', endpoints);
  if (email) query = query.eq('usuario_email', email.toLowerCase());
  const { error } = await query;
  if (error) throw new Error('push_storage_error');
}

async function listSubscriptions(emails: string[]): Promise<StoredSubscription[]> {
  if (!supabaseAdmin || !emails.length) return [];
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('endpoint,p256dh,auth,usuario_email')
    .in('usuario_email', emails.map((email) => email.toLowerCase()));
  if (error || !data) return [];
  return data as StoredSubscription[];
}

// Envía a los editores indicados (ya filtrados por rol desde la base). Nunca lanza.
export async function notifyEditors(editorEmails: string[], payload: PushPayload) {
  try {
    const config = getPushConfig(process.env);
    if (!config || !supabaseAdmin) return null;
    const subscriptions = await listSubscriptions(editorEmails);
    if (!subscriptions.length) return null;
    const details = { vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey }, TTL: 60 * 60 * 24, timeout: 5000 };
    const summary = await deliverPush({
      subscriptions,
      payload,
      send: (subscription, body) =>
        webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, body, details),
      removeExpired: (endpoints) => removeSubscriptions(endpoints),
    });
    console.info('push', { attempted: summary.attempted, sent: summary.sent, removed: summary.removed, failed: summary.failed });
    return summary;
  } catch {
    console.warn('push: error inesperado al notificar (ignorado)');
    return null;
  }
}
