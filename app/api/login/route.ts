import { NextResponse } from 'next/server';
import {
  createSessionToken,
  getSessionConfigurationError,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '@/app/lib/auth';
import { getStore } from '@/app/lib/store';
import { verifyPassword } from '@/app/lib/password';
import { getPersistenceConfigurationError } from '@/app/lib/supabase';

export async function POST(request: Request) {
  const configurationError = getSessionConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 });
  }
  const persistenceError = getPersistenceConfigurationError();
  if (persistenceError && process.env.ALLOW_DEMO_DATA !== 'true') {
    return NextResponse.json({ error: persistenceError }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  const state = await getStore();
  const user = state.usuarios.find((candidate) => candidate.email.toLowerCase() === email);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos.' }, { status: 401 });
  }

  const { passwordHash: _passwordHash, ...safeUser } = user;
  const response = NextResponse.json({ ok: true, me: safeUser });
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user), sessionCookieOptions());
  return response;
}
