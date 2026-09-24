import { NextResponse } from 'next/server';
import { getPublicUserFromRequest } from '@/app/lib/auth';
import { getStore } from '@/app/lib/store';

export async function GET(request: Request) {
  const me = await getPublicUserFromRequest(request);
  if (!me) {
    return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
  }

  const state = await getStore();
  return NextResponse.json({
    ...state,
    usuarios: state.usuarios.map(({ passwordHash: _passwordHash, ...user }) => user),
    me,
  });
}
