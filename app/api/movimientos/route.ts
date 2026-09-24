import { NextResponse } from 'next/server';
import { getEditorFromRequest } from '@/app/lib/auth';
import { getStore, setStore } from '@/app/lib/store';

export async function POST(request: Request) {
  const editor = await getEditorFromRequest(request);
  if (!editor) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const generadorId = String(body.generadorId ?? '');
  const fecha = String(body.fecha ?? '');
  const origen = String(body.origen ?? '').trim();
  const destino = String(body.destino ?? '').trim();
  const tipoTransporte = String(body.tipoTransporte ?? 'Propio');
  const notas = String(body.notas ?? '').trim();

  if (!generadorId || !fecha || !origen || !destino) {
    return NextResponse.json({ error: 'Completa generador, fecha, origen y destino.' }, { status: 400 });
  }

  const state = await getStore();
  const normalizedType =
    tipoTransporte === 'Propio' || tipoTransporte === 'Local' || tipoTransporte === 'Nacex'
      ? (tipoTransporte as 'Propio' | 'Local' | 'Nacex')
      : 'Propio';

  const next = {
    ...state,
    movimientos: [
      ...state.movimientos,
      {
        id: `m-${Date.now()}`,
        generador_id: generadorId,
        fecha,
        origen,
        destino,
        tipo_transporte: normalizedType,
        notas: notas || undefined,
        estado: 'pendiente' as const,
        usuario: editor.nombre,
        creado_en: new Date().toISOString(),
      },
    ],
  };

  await setStore(next);
  return NextResponse.json({ ok: true, movimiento: next.movimientos[next.movimientos.length - 1] });
}
