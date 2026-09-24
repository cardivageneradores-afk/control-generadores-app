import { NextResponse } from 'next/server';
import { getEditorFromRequest } from '@/app/lib/auth';
import { getStore, setStore } from '@/app/lib/store';

export async function DELETE(request: Request, { params }: { params: Promise<{ email: string }> }) {
  if (!getEditorFromRequest(request)) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const { email } = await params;
  const decoded = decodeURIComponent(email);
  const state = getStore();

  const nextList = state.destinatarios.filter((item) => item.toLowerCase() !== decoded.toLowerCase());
  setStore({ ...state, destinatarios: nextList });
  return NextResponse.json({ ok: true, destinatarios: nextList });
}
