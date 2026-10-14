import assert from 'node:assert/strict';
import test from 'node:test';
import { EmailConfigurationError, EmailDeliveryError } from './email-delivery.ts';
import { deliverSummaryViaGmail, describeGmailFailure } from './gmail-delivery.ts';
import { getMadridWeekStart, isAuthorizedCronRequest } from './weekly-cron.ts';

const message = { to: ['a@x.com', 'b@x.com'], subject: 'S', html: '<p>h</p>', text: 't' };

test('gmail sends a single message with every recipient visible together', async () => {
  const mails = [];
  const result = await deliverSummaryViaGmail({
    user: 'cardiva@gmail.com',
    message,
    sendMail: async (mail) => { mails.push(mail); },
  });
  assert.equal(mails.length, 1);
  assert.deepEqual(mails[0].to, ['a@x.com', 'b@x.com']);
  assert.equal(mails[0].from, 'Control Generadores <cardiva@gmail.com>');
  assert.equal(result.partial, false);
  assert.deepEqual(result.sent, ['a@x.com', 'b@x.com']);
});

test('gmail splits into messages of at most 100 recipients', async () => {
  const to = Array.from({ length: 250 }, (_, i) => `u${i}@x.com`);
  const sizes = [];
  const result = await deliverSummaryViaGmail({
    user: 'u@gmail.com',
    message: { ...message, to },
    sendMail: async (mail) => { sizes.push(mail.to.length); },
  });
  assert.deepEqual(sizes, [100, 100, 50]);
  assert.equal(result.sent.length, 250);
});

test('gmail reports rejected addresses and failed chunks without leaking error details', async () => {
  const rejectedResult = await deliverSummaryViaGmail({
    user: 'u@gmail.com',
    message,
    sendMail: async () => ({ rejected: ['B@x.com'] }),
  });
  assert.equal(rejectedResult.partial, true);
  assert.deepEqual(rejectedResult.sent, ['a@x.com']);
  assert.deepEqual(rejectedResult.failed.map((f) => f.email), ['b@x.com']);

  let call = 0;
  const to = Array.from({ length: 101 }, (_, i) => `u${i}@x.com`);
  const chunkResult = await deliverSummaryViaGmail({
    user: 'u@gmail.com',
    message: { ...message, to },
    sendMail: async () => {
      if (call++ === 1) throw Object.assign(new Error('secret-pass leaked'), { responseCode: 421 });
    },
  });
  assert.equal(chunkResult.partial, true);
  assert.equal(chunkResult.sent.length, 100);
  assert.deepEqual(chunkResult.failed.map((f) => f.email), ['u100@x.com']);
  assert.ok(!JSON.stringify(chunkResult).includes('secret-pass'));
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
