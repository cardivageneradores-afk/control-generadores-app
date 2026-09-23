import { NextResponse } from 'next/server';
import { getStore, setStore } from '@/app/lib/store';

export async function DELETE(_request: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  const decoded = decodeURIComponent(email);
  const state = getStore();

  const nextList = state.destinatarios.filter((item) => item.toLowerCase() !== decoded.toLowerCase());
  setStore({ ...state, destinatarios: nextList });
  return NextResponse.json({ ok: true, destinatarios: nextList });
}
