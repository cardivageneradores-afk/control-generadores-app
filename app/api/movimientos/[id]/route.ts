import { NextResponse } from 'next/server';
import { getEditorFromRequest } from '@/app/lib/auth';
import { getStore, setStore } from '@/app/lib/store';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!getEditorFromRequest(request)) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const { id } = await params;
  const state = getStore();
  const next = {
    ...state,
    movimientos: state.movimientos.filter((movement) => movement.id !== id),
  };

  setStore(next);
  return NextResponse.json({ ok: true, movimientos: next.movimientos });
}
