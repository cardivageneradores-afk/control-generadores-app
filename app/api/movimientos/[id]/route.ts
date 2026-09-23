import { NextResponse } from 'next/server';
import { getStore, setStore } from '@/app/lib/store';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = getStore();
  const next = {
    ...state,
    movimientos: state.movimientos.filter((movement) => movement.id !== id),
  };

  setStore(next);
  return NextResponse.json({ ok: true, movimientos: next.movimientos });
}
