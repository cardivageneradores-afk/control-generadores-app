import { NextResponse } from 'next/server';
import { getStore, setStore } from '@/app/lib/store';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = getStore();
  const next = {
    ...state,
    movimientos: state.movimientos.map((movement) =>
      movement.id === id
        ? {
            ...movement,
            estado: 'completado' as const,
            completado_en: new Date().toISOString(),
          }
        : movement,
    ),
  };

  setStore(next);
  return NextResponse.json({ ok: true, movimiento: next.movimientos.find((movement) => movement.id === id) });
}
