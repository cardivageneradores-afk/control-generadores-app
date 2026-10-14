import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearLoginRateLimit,
  createLoginRateLimitKeys,
  getClientIp,
  isLoginRateLimited,
} from './login-rate-limit.ts';

test('login rate limit keys are stable, purpose-separated hashes without raw identifiers', () => {
  const first = createLoginRateLimitKeys(' USER@example.com ', '203.0.113.8', 'x'.repeat(32));
  const normalized = createLoginRateLimitKeys('user@example.com', '203.0.113.8', 'x'.repeat(32));
  const otherIp = createLoginRateLimitKeys('user@example.com', '203.0.113.9', 'x'.repeat(32));

  assert.deepEqual(first, normalized);
  assert.notEqual(first.ipHash, first.identityHash);
  assert.notEqual(first.ipHash, otherIp.ipHash);
  assert.equal(first.ipHash.length, 64);
  assert.equal(first.identityHash.length, 64);
  assert.equal(JSON.stringify(first).includes('user@example.com'), false);
});

test('client IP extraction accepts only valid forwarded or real IP addresses', () => {
  assert.equal(
    getClientIp(new Request('https://example.test', { headers: { 'x-forwarded-for': '203.0.113.8, 10.0.0.1' } })),
    '203.0.113.8',
  );
  assert.equal(
    getClientIp(new Request('https://example.test', { headers: { 'x-forwarded-for': 'spoofed', 'x-real-ip': '2001:db8::1' } })),
    '2001:db8::1',
  );
  assert.equal(getClientIp(new Request('https://example.test')), 'unknown');
});

test('login attempts are sent to persistent storage and storage errors are not ignored', async () => {
  let call;
  const rpc = async (...args) => {
    call = args;
    return { data: true, error: null };
  };

  assert.equal(await isLoginRateLimited(rpc, 'user@example.com', '203.0.113.8', 'x'.repeat(32)), true);
  assert.equal(call[0], 'consume_login_attempt');
  assert.equal(call[1].p_ip_hash.length, 64);
  assert.equal(call[1].p_identity_hash.length, 64);
  await clearLoginRateLimit(async (...args) => {
    call = args;
    return { error: null };
  }, 'user@example.com', '203.0.113.8', 'x'.repeat(32));
  assert.equal(call[0], 'clear_login_attempts');
  assert.equal(call[1].p_identity_hash.length, 64);
  await assert.rejects(
    isLoginRateLimited(async () => ({ data: null, error: { message: 'database unavailable' } }), 'a', 'unknown', 'x'),
    (error) => error.message === 'database unavailable',
  );
});
