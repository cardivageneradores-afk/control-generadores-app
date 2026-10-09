import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOptionalTime } from './movement-time.ts';

test('accepts valid 24-hour times and trims whitespace', () => {
  assert.deepEqual(parseOptionalTime('09:05'), { valid: true, value: '09:05' });
  assert.deepEqual(parseOptionalTime(' 23:59 '), { valid: true, value: '23:59' });
});

test('treats an omitted or empty time as optional', () => {
  assert.deepEqual(parseOptionalTime(undefined), { valid: true, value: undefined });
  assert.deepEqual(parseOptionalTime(null), { valid: true, value: undefined });
  assert.deepEqual(parseOptionalTime('  '), { valid: true, value: undefined });
});

test('rejects malformed and out-of-range times', () => {
  for (const value of ['9:05', '24:00', '12:60', '12:00:00', 900]) {
    assert.deepEqual(parseOptionalTime(value), { valid: false });
  }
});
