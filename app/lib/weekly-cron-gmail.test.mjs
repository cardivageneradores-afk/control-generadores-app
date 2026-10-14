import assert from 'node:assert/strict';
import test from 'node:test';
import { EmailConfigurationError, EmailDeliveryError } from './email-delivery.ts';
import { deliverSummaryViaGmail, describeGmailFailure } from './gmail-delivery.ts';
import { getMadridWeekStart, isAuthorizedCronRequest } from './weekly-cron.ts';

const message = { to: ['a@x.com', 'b@x.com'], subject: 'S', html: '<p>h</p>', text: 't' };

test('gmail sends one message per recipient without exposing other addresses', async () => {
  const mails = [];
  const result = await deliverSummaryViaGmail({
    user: 'cardiva@gmail.com',
    message,
    sendMail: async (mail) => { mails.push(mail); },
  });
  assert.deepEqual(mails.map((m) => m.to), ['a@x.com', 'b@x.com']);
  assert.equal(mails[0].from, 'Control Generadores <cardiva@gmail.com>');
  assert.equal(result.partial, false);
  assert.deepEqual(result.sent, ['a@x.com', 'b@x.com']);
});

test('gmail reports partial failures per recipient without leaking error details', async () => {
  const result = await deliverSummaryViaGmail({
    user: 'u@gmail.com',
    message,
    sendMail: async (mail) => {
      if (mail.to === 'b@x.com') throw Object.assign(new Error('secret-pass leaked'), { responseCode: 550 });
    },
  });
  assert.equal(result.partial, true);
  assert.deepEqual(result.failed, [{ email: 'b@x.com', reason: 'Gmail rechazó la dirección destinataria.' }]);
  assert.ok(!JSON.stringify(result).includes('secret-pass'));
});

test('gmail throws when every recipient fails and hides raw errors', async () => {
  await assert.rejects(
    deliverSummaryViaGmail({
      user: 'u@gmail.com',
      message,
      sendMail: async () => { throw Object.assign(new Error('pw=abc'), { code: 'EAUTH' }); },
    }),
    (error) => error instanceof EmailDeliveryError
      && error.message.includes('credenciales')
      && !error.message.includes('pw=abc'),
  );
});

test('gmail rejects recipient lists above the daily limit', async () => {
  const to = Array.from({ length: 451 }, (_, i) => `u${i}@x.com`);
  await assert.rejects(
    deliverSummaryViaGmail({ user: 'u@gmail.com', message: { ...message, to }, sendMail: async () => {} }),
    EmailConfigurationError,
  );
});

test('describeGmailFailure maps timeouts and unknown errors', () => {
  assert.match(describeGmailFailure({ code: 'ETIMEDOUT' }), /a tiempo/);
  assert.match(describeGmailFailure(undefined), /inesperado/);
});

test('cron auth requires a configured secret and an exact bearer token', () => {
  assert.equal(isAuthorizedCronRequest('Bearer s3', undefined), false);
  assert.equal(isAuthorizedCronRequest('Bearer ', ''), false);
  assert.equal(isAuthorizedCronRequest(null, 's3'), false);
  assert.equal(isAuthorizedCronRequest('Bearer wrong', 's3'), false);
  assert.equal(isAuthorizedCronRequest('s3', 's3'), false);
  assert.equal(isAuthorizedCronRequest('Bearer s3', 's3'), true);
});

test('week start is the Madrid Monday, stable across the cron delay and DST', () => {
  assert.equal(getMadridWeekStart(new Date('2026-10-19T06:00:00Z')), '2026-10-19');
  assert.equal(getMadridWeekStart(new Date('2026-07-06T06:00:00Z')), '2026-07-06');
  assert.equal(getMadridWeekStart(new Date('2026-10-18T22:30:00Z')), '2026-10-19');
  assert.equal(getMadridWeekStart(new Date('2026-10-25T10:00:00Z')), '2026-10-19');
});
