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

  const nextUsers = state.usuarios.filter(
    (user) => user.email.toLowerCase() !== decoded.toLowerCase(),
  );

  await setStore({ ...state, usuarios: nextUsers });
  return NextResponse.json({
    ok: true,
    usuarios: nextUsers.map(({ passwordHash: _passwordHash, ...user }) => user),
  });
}, 'usuarios');
