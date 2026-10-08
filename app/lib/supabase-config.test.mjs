import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isValidSupabaseServerKey,
  isValidSupabaseUrl,
  resolveSupabaseConfiguration,
} from './supabase-config.ts';

test('accepts the current Supabase server environment names without duplicate URL variables', () => {
  assert.deepEqual(
    resolveSupabaseConfiguration({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test-key',
    }),
    {
      url: 'https://project.supabase.co',
      secretKey: 'sb_secret_test-key',
      credentialVariable: 'SUPABASE_SECRET_KEY',
    },
  );
});

test('accepts legacy integration environment names and prefers the new names when both exist', () => {
  assert.deepEqual(
    resolveSupabaseConfiguration({
      SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_URL: 'https://legacy.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test-key',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJabc.test.signature',
    }),
    {
      url: 'https://project.supabase.co',
      secretKey: 'sb_secret_test-key',
      credentialVariable: 'SUPABASE_SECRET_KEY',
    },
  );

  assert.deepEqual(
    resolveSupabaseConfiguration({
      NEXT_PUBLIC_SUPABASE_URL: 'https://legacy.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJabc.test.signature',
    }),
    {
      url: 'https://legacy.supabase.co',
      secretKey: 'eyJabc.test.signature',
      credentialVariable: 'SUPABASE_SERVICE_ROLE_KEY',
    },
  );
});

test('accepts server secret keys and legacy service-role JWTs, but not public keys', () => {
  assert.equal(isValidSupabaseServerKey('sb_secret_test-key'), true);
  assert.equal(isValidSupabaseServerKey('eyJabc.test.signature'), true);
  assert.equal(isValidSupabaseServerKey('sb_publishable_test-key'), false);
  assert.equal(isValidSupabaseUrl('http://127.0.0.1:54321'), true);
  assert.equal(isValidSupabaseUrl('http://example.com'), false);
});
