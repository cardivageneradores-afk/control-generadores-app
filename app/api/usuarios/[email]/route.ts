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

  const nextUsers = state.usuarios.filter(
    (user) => user.email.toLowerCase() !== decoded.toLowerCase(),
  );

  setStore({ ...state, usuarios: nextUsers });
  return NextResponse.json({
    ok: true,
    usuarios: nextUsers.map(({ password: _password, ...user }) => user),
  });
}
