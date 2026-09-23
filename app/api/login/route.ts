import { NextResponse } from 'next/server';
import { getStore, setCurrentUser } from '@/app/lib/store';

export async function POST(request: Request) {
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

  setCurrentUser(user);
  return NextResponse.json({ ok: true, me: { ...user, password: undefined } });
}
