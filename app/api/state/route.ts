import { NextResponse } from 'next/server';
import { withStoreErrorHandling } from '@/app/lib/api-errors';
import { getPublicUserFromRequest } from '@/app/lib/auth';
import { getStore } from '@/app/lib/store';

export const GET = withStoreErrorHandling(async (request: Request) => {
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
}, 'state');
