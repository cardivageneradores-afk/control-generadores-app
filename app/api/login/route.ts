import { NextResponse } from 'next/server';
import {
  createSessionToken,
  getSessionConfigurationError,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '@/app/lib/auth';
import { getStore } from '@/app/lib/store';

export async function POST(request: Request) {
  const configurationError = getSessionConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  const state = getStore();
  const user = state.usuarios.find(
    (candidate) => candidate.email.toLowerCase() === email && candidate.password === password,
  );

  if (!user) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, me: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } });
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user), sessionCookieOptions());
  return response;
}
