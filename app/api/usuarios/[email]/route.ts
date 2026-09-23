import { NextResponse } from 'next/server';
import { getStore, setStore } from '@/app/lib/store';

export async function DELETE(_request: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  const decoded = decodeURIComponent(email);
  const state = getStore();

  const nextUsers = state.usuarios.filter(
    (user) => user.email.toLowerCase() !== decoded.toLowerCase(),
  );

  setStore({ ...state, usuarios: nextUsers });
  return NextResponse.json({ ok: true, usuarios: nextUsers });
}
