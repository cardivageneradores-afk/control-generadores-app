import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deliverSummaryEmail,
  EmailConfigurationError,
  EmailDeliveryError,
} from './email-delivery.ts';

const message = {
  to: ['ops@example.com'],
  subject: 'Resumen',
  html: '<p>Resumen</p>',
  text: 'Resumen',
};

test('reports missing Resend configuration with actionable variable names', async () => {
  await assert.rejects(
    deliverSummaryEmail({ allowDemo: false, message }),
    (error) => error instanceof EmailConfigurationError
      && error.message.includes('RESEND_API_KEY')
      && error.message.includes('RESEND_FROM_EMAIL')
      && error.message.includes('dominio verificado'),
  );
});

test('allows explicitly enabled development email simulation without credentials', async () => {
  const result = await deliverSummaryEmail({ allowDemo: true, message });

  assert.equal(result.mode, 'demo');
  assert.deepEqual(result.recipients, message.to);
});

test('sends with the configured sender and returns the Resend message id', async () => {
  let sentMessage;
  const result = await deliverSummaryEmail({
    apiKey: 'test-key',
    from: 'Control <mail@example.com>',
    allowDemo: false,
    message,
    send: async (payload) => {
      sentMessage = payload;
      return { data: { id: 'email-1' }, error: null };
    },
  });

  assert.equal(sentMessage.from, 'Control <mail@example.com>');
  assert.deepEqual(sentMessage.to, message.to);
  assert.equal(result.id, 'email-1');
  assert.equal(result.mode, 'resend');
});

test('surfaces provider rejection details and suggests configuration checks', async () => {
  await assert.rejects(
    deliverSummaryEmail({
      apiKey: 'test-key',
      from: 'mail@example.com',
      allowDemo: false,
      message,
      send: async () => ({ error: { message: 'domain is not verified' } }),
    }),
    (error) => error instanceof EmailDeliveryError
      && error.message.includes('domain is not verified')
      && error.message.includes('dominio remitente verificado'),
  );
});

test('does not report success when Resend does not confirm the message id', async () => {
  await assert.rejects(
    deliverSummaryEmail({
      apiKey: 'test-key',
      from: 'mail@example.com',
      allowDemo: false,
      message,
      send: async () => ({ data: null, error: null }),
    }),
    (error) => error instanceof EmailDeliveryError
      && error.message.includes('no confirmó la aceptación'),
  );
});

test('turns network failures into actionable delivery errors while preserving the cause', async () => {
  const networkError = new Error('connection reset');

  await assert.rejects(
    deliverSummaryEmail({
      apiKey: 'test-key',
      from: 'mail@example.com',
      allowDemo: false,
      message,
      send: async () => { throw networkError; },
    }),
    (error) => error instanceof EmailDeliveryError
      && error.message.includes('conectar con Resend')
      && error.cause === networkError,
  );
});
