import { NextResponse } from 'next/server';
import { getEditorFromRequest } from '@/app/lib/auth';
import { getStore, setStore } from '@/app/lib/store';

export async function POST(request: Request) {
  if (!getEditorFromRequest(request)) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const codigo = String(body.codigo ?? '').trim();
  const modelo = String(body.modelo ?? '').trim();
  const ubicacion = String(body.ubicacion ?? 'Oficina').trim() || 'Oficina';
  const estado = String(body.estado ?? 'en-oficina');

  if (!codigo) {
    return NextResponse.json({ error: 'Indica al menos el código del generador.' }, { status: 400 });
  }

  const state = getStore();
  const normalizedState =
    estado === 'estable' || estado === 'en-oficina' || estado === 'en-transito'
      ? (estado as 'estable' | 'en-oficina' | 'en-transito')
      : 'en-oficina';

  const nextState = {
    ...state,
    generadores: [
      ...state.generadores,
      {
        id: `g-${Date.now()}`,
        codigo,
        modelo,
        ubicacion,
        estado: normalizedState,
      },
    ],
  };

  setStore(nextState);
  return NextResponse.json({ ok: true, generador: nextState.generadores[nextState.generadores.length - 1] });
}
