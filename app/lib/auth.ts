import { createHmac, timingSafeEqual } from 'node:crypto';
import { getStore } from './store';
import type { User } from './types';

export const SESSION_COOKIE_NAME = 'control_generadores_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const MIN_SESSION_SECRET_LENGTH = 32;
const SESSION_SECRET_ERROR = 'SESSION_SECRET debe tener al menos 32 caracteres. Configúrala en Vercel.';

interface SessionPayload {
  sub: string;
  exp: number;
}

export function getSessionConfigurationError() {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= MIN_SESSION_SECRET_LENGTH ? null : SESSION_SECRET_ERROR;
}

function getSessionSecret() {
  const error = getSessionConfigurationError();
  if (error) throw new Error(error);
  return process.env.SESSION_SECRET as string;
}

function encode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(value: string) {
  return createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

function verifySignature(value: string, signature: string) {
  try {
    const expected = Buffer.from(sign(value), 'base64url');
    const received = Buffer.from(signature, 'base64url');
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

function getCookieValue(request: Request) {
  const cookies = request.headers.get('cookie')?.split(';') ?? [];
  const sessionCookie = cookies.find((cookie) => cookie.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
  return sessionCookie?.trim().slice(SESSION_COOKIE_NAME.length + 1) ?? null;
}

function publicUser(user: User): Omit<User, 'password'> {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

export function getPublicUserFromRequest(request: Request): Omit<User, 'password'> | null {
  const token = getCookieValue(request);
  if (!token) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature || !verifySignature(encodedPayload, signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.sub || !Number.isInteger(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    const user = getStore().usuarios.find((candidate) => candidate.id === payload.sub);
    return user ? publicUser(user) : null;
  } catch {
    return null;
  }
}

export function getEditorFromRequest(request: Request) {
  const user = getPublicUserFromRequest(request);
  return user?.rol === 'editor' ? user : null;
}

export function createSessionToken(user: User) {
  const payload = encode(JSON.stringify({
    sub: user.id,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  } satisfies SessionPayload));
  return `${payload}.${sign(payload)}`;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}

export function clearSessionCookieOptions() {
  return {
    ...sessionCookieOptions(),
    maxAge: 0,
  };
}
