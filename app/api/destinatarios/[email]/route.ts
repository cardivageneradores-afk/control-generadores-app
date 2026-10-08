import { NextResponse } from 'next/server';
import { withStoreErrorHandling } from '@/app/lib/api-errors';
import { getEditorFromRequest } from '@/app/lib/auth';
import { getStore, setStore } from '@/app/lib/store';

export const DELETE = withStoreErrorHandling(async (request: Request, { params }: { params: Promise<{ email: string }> }) => {
  if (!(await getEditorFromRequest(request))) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const { email } = await params;
  const decoded = decodeURIComponent(email);
  const state = await getStore();

  const nextList = state.destinatarios.filter((item) => item.toLowerCase() !== decoded.toLowerCase());
  await setStore({ ...state, destinatarios: nextList });
  return NextResponse.json({ ok: true, destinatarios: nextList });
}, 'destinatarios');
