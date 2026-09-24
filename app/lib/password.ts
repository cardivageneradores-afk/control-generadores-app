import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  if (storedHash.startsWith('demo$')) {
    const expected = Buffer.from(storedHash.slice(5));
    const received = Buffer.from(password);
    return process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_DEMO_DATA === 'true' &&
      expected.length === received.length &&
      timingSafeEqual(expected, received);
  }

  const [algorithm, salt, expectedHex] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const derivedKey = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey);
}
