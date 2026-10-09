import { NextResponse } from 'next/server';
import { withStoreErrorHandling } from '@/app/lib/api-errors';
import { getEditorFromRequest } from '@/app/lib/auth';
import { getStore, setStore } from '@/app/lib/store';
import { parseOptionalTime } from '@/app/lib/movement-time';

export const POST = withStoreErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  if (!(await getEditorFromRequest(request))) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { id } = await params;
  const hasPickupTime = Object.prototype.hasOwnProperty.call(body, 'horaRecogida');
  const hasDeliveryTime = Object.prototype.hasOwnProperty.call(body, 'horaEntrega');
  const horaRecogida = parseOptionalTime(body.horaRecogida);
  const horaEntrega = parseOptionalTime(body.horaEntrega);

  if (!horaRecogida.valid || !horaEntrega.valid) {
    return NextResponse.json({ error: 'Las horas de recogida y entrega deben tener formato HH:mm.' }, { status: 400 });
  }

  const state = await getStore();
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
        hora_recogida: hasPickupTime ? horaRecogida.value : movement.hora_recogida,
        hora_entrega: hasDeliveryTime ? horaEntrega.value : movement.hora_entrega,
      };
    }),
  };

  await setStore(next);
  return NextResponse.json({ ok: true, movimiento: next.movimientos.find((movement) => movement.id === id) });
}, 'movimientos');
