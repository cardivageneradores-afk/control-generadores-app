import { NextResponse } from 'next/server';
import { getEditorFromRequest } from '@/app/lib/auth';
import { getStore, setStore } from '@/app/lib/store';

export async function POST(request: Request) {
  if (!getEditorFromRequest(request)) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim();

  if (!email) {
    return NextResponse.json({ error: 'Email no válido.' }, { status: 400 });
  }

  const state = getStore();
  const nextList = state.destinatarios.includes(email)
    ? state.destinatarios
    : [...state.destinatarios, email];

  setStore({ ...state, destinatarios: nextList });
  return NextResponse.json({ ok: true, destinatarios: nextList });
}
