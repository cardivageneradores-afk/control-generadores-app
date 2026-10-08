import { NextResponse } from 'next/server';
import { withStoreErrorHandling } from '@/app/lib/api-errors';
import { getEditorFromRequest } from '@/app/lib/auth';
import { getStore, setStore } from '@/app/lib/store';

export const POST = withStoreErrorHandling(async (request: Request) => {
  if (!(await getEditorFromRequest(request))) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim();

  if (!email) {
    return NextResponse.json({ error: 'Email no válido.' }, { status: 400 });
  }

  const state = await getStore();
  const nextList = state.destinatarios.includes(email)
    ? state.destinatarios
    : [...state.destinatarios, email];

  await setStore({ ...state, destinatarios: nextList });
  return NextResponse.json({ ok: true, destinatarios: nextList });
}, 'destinatarios');
