import { NextResponse } from 'next/server';
import { getEditorFromRequest } from '@/app/lib/auth';
import { getStore, setStore } from '@/app/lib/store';
import { hashPassword } from '@/app/lib/password';

export async function POST(request: Request) {
  if (!(await getEditorFromRequest(request))) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim();
  const nombre = String(body.nombre ?? '').trim();
  const password = String(body.password ?? '').trim();
  const rol = String(body.rol ?? 'editor');

  if (!email || !nombre) {
    return NextResponse.json({ error: 'Nombre y email válidos son obligatorios.' }, { status: 400 });
  }

  const state = await getStore();
  const normalizedRole = rol === 'editor' || rol === 'lector' ? (rol as 'editor' | 'lector') : 'editor';
  const existing = state.usuarios.find((user) => user.email.toLowerCase() === email.toLowerCase());

  const passwordHash = password ? await hashPassword(password) : null;
  const nextUsers = existing
    ? state.usuarios.map((user) =>
        user.email.toLowerCase() === email.toLowerCase()
          ? {
              ...user,
              nombre,
              rol: normalizedRole,
              passwordHash: passwordHash ?? user.passwordHash,
            }
          : user,
      )
    : [
        ...state.usuarios,
        {
          id: `u-${Date.now()}`,
          email,
          nombre,
          rol: normalizedRole,
          passwordHash: passwordHash ?? '',
        },
      ];

  if (!existing && !passwordHash) {
    return NextResponse.json({ error: 'La contraseña es obligatoria para usuarios nuevos.' }, { status: 400 });
  }
  await setStore({ ...state, usuarios: nextUsers });
  return NextResponse.json({
    ok: true,
    usuarios: nextUsers.map(({ passwordHash: _passwordHash, ...user }) => user),
  });
}
