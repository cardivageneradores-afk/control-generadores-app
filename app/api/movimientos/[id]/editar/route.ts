import { NextResponse } from 'next/server';
import { getEditorFromRequest } from '@/app/lib/auth';
import { getStore, setStore } from '@/app/lib/store';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!getEditorFromRequest(request)) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { id } = await params;

  const state = getStore();
  const edited = state.movimientos.find((movement) => movement.id === id);

  if (!edited) {
    return NextResponse.json({ error: 'Movimiento no encontrado.' }, { status: 404 });
  }

  const next = {
    ...state,
    movimientos: state.movimientos.map((movement) => {
      if (movement.id !== id) {
        return movement;
      }

      const nextType = String(body.tipoTransporte ?? movement.tipo_transporte);
      const normalizedType =
        nextType === 'Propio' || nextType === 'Local' || nextType === 'Nacex'
          ? (nextType as 'Propio' | 'Local' | 'Nacex')
          : movement.tipo_transporte;

      return {
        ...movement,
        generador_id: String(body.generadorId ?? movement.generador_id),
        fecha: String(body.fecha ?? movement.fecha),
        origen: String(body.origen ?? movement.origen).trim(),
        destino: String(body.destino ?? movement.destino).trim(),
        tipo_transporte: normalizedType,
        notas: String(body.notas ?? movement.notas ?? '').trim() || undefined,
      };
    }),
  };

  setStore(next);
  return NextResponse.json({ ok: true, movimiento: next.movimientos.find((movement) => movement.id === id) });
}
