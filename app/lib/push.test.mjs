import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildCompletionPayload,
  deliverPush,
  getPushConfig,
  isExpiredSubscriptionError,
  isValidSubscriptionInput,
  selectEditorEmails,
} from './push.ts';

const PUB = 'B'.repeat(87);
const PRIV = 'a'.repeat(43);
const env = { VAPID_PUBLIC_KEY: PUB, VAPID_PRIVATE_KEY: PRIV, VAPID_SUBJECT: 'mailto:cardiva.generadores@gmail.com' };
const sub = (n) => ({ endpoint: `https://push.example/${n}`, p256dh: 'p', auth: 'a', usuario_email: `u${n}@x.com` });
const payload = { title: 't', body: 'b', url: '/', tag: 'x' };

test('sin variables VAPID la función queda desactivada', () => {
  assert.equal(getPushConfig({}), null);
  assert.equal(getPushConfig({ ...env, VAPID_PRIVATE_KEY: '' }), null);
  assert.equal(getPushConfig({ ...env, VAPID_SUBJECT: 'nada' }), null);
  assert.deepEqual(getPushConfig(env), { publicKey: PUB, privateKey: PRIV, subject: env.VAPID_SUBJECT });
  assert.equal(getPushConfig({ ...env, VAPID_PUBLIC_KEY: undefined, NEXT_PUBLIC_VAPID_PUBLIC_KEY: PUB })?.publicKey, PUB);
});

test('destinatarios: solo editores y sin quien completó', () => {
  const users = [
    { email: 'Ana@x.com', rol: 'editor' },
    { email: 'bea@x.com', rol: 'editor' },
    { email: 'transportista@x.com', rol: 'lector' },
    { email: 'raro@x.com', rol: 'invalido' },
    { email: 'ana@x.com', rol: 'editor' },
  ];
  assert.deepEqual(selectEditorEmails(users, 'BEA@x.com'), ['ana@x.com']);
  assert.deepEqual(selectEditorEmails(users, 'transportista@x.com'), ['ana@x.com', 'bea@x.com']);
});

test('texto de la notificación', () => {
  const base = { movementId: 'm1', generatorCode: '262', origin: 'HM Sant Jordi', destination: 'Clínica Corachan', completedBy: 'Pepe', now: new Date('2026-10-19T09:30:00Z') };
  const delivered = buildCompletionPayload({ ...base, action: 'entregado' });
  assert.equal(delivered.title, 'Generador 262 entregado en Clínica Corachan');
  assert.match(delivered.body, /Marcado por Pepe · 19 oct/);
  assert.match(delivered.body, /11:30/);
  assert.equal(buildCompletionPayload({ ...base, action: 'recogido' }).title, 'Generador 262 recogido en HM Sant Jordi');
  assert.equal(delivered.tag, 'movimiento-m1');
});

test('validación de la suscripción', () => {
  const ok = { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) } };
  assert.equal(isValidSubscriptionInput(ok), true);
  assert.equal(isValidSubscriptionInput({ ...ok, endpoint: 'http://x.com/1' }), false);
  assert.equal(isValidSubscriptionInput({ ...ok, keys: { p256dh: '', auth: 'B'.repeat(22) } }), false);
  assert.equal(isValidSubscriptionInput(null), false);
});

test('se eliminan suscripciones caducadas (404/410) y el resto se cuenta', async () => {
  const removed = [];
  const summary = await deliverPush({
    subscriptions: [sub(1), sub(2), sub(3), sub(4)],
    payload,
    send: async (s) => {
      if (s.endpoint.endsWith('/2')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      if (s.endpoint.endsWith('/3')) throw Object.assign(new Error('nf'), { statusCode: 404 });
      if (s.endpoint.endsWith('/4')) throw Object.assign(new Error('boom'), { statusCode: 500 });
    },
    removeExpired: async (endpoints) => removed.push(...endpoints),
  });
  assert.deepEqual(removed.sort(), ['https://push.example/2', 'https://push.example/3']);
  assert.deepEqual(summary, { attempted: 4, sent: 1, removed: 2, failed: 1 });
  assert.equal(isExpiredSubscriptionError({ statusCode: 410 }), true);
  assert.equal(isExpiredSubscriptionError({ statusCode: 500 }), false);
});

test('best-effort: errores, timeouts y fallo al limpiar no lanzan', async () => {
  const summary = await deliverPush({
    subscriptions: [sub(1), sub(2)],
    payload,
    timeoutMs: 20,
    send: (s) => (s.endpoint.endsWith('/1') ? new Promise(() => {}) : Promise.reject(Object.assign(new Error('x'), { statusCode: 410 }))),
    removeExpired: async () => { throw new Error('db'); },
  });
  assert.equal(summary.sent, 0);
  assert.equal(summary.failed, 2);
});

test('permisos y no bloqueo (comprobación estática de rutas)', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const subscribe = read('../api/push/suscribir/route.ts');
  assert.match(subscribe, /getEditorFromRequest/);
  assert.doesNotMatch(subscribe, /getPublicUserFromRequest/);
  const unsubscribe = read('../api/push/desuscribir/route.ts');
  assert.match(unsubscribe, /getPublicUserFromRequest/);
  assert.match(unsubscribe, /status: 401/);
  const complete = read('../api/movimientos/[id]/completar/route.ts');
  const setIdx = complete.indexOf('await setStore');
  const tryIdx = complete.indexOf('try {', setIdx);
  assert.ok(setIdx > 0 && tryIdx > setIdx, 'el push va después de guardar y dentro de try/catch');
  assert.match(complete.slice(tryIdx), /notifyEditors[\s\S]*catch/);
});

test('el service worker muestra la notificación y abre la app', () => {
  const sw = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /addEventListener\('push'/);
  assert.match(sw, /showNotification/);
  assert.match(sw, /addEventListener\('notificationclick'/);
  assert.match(sw, /openWindow/);
});

test('la migración activa RLS y da permisos solo a service_role', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261019120000_push_subscriptions.sql', import.meta.url), 'utf8');
  assert.match(sql, /enable row level security/);
  assert.match(sql, /to service_role/);
  assert.match(sql, /endpoint text not null unique/);
  assert.doesNotMatch(sql, /app_state_revision|replace_app_state/);
});
