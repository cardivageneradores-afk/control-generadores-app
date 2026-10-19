import { NextResponse } from 'next/server';
import { withStoreErrorHandling } from '@/app/lib/api-errors';
import { getPublicUserFromRequest } from '@/app/lib/auth';
import { completeMovementWithAction, parseCompletionAction } from '@/app/lib/movement-completion';
import { getStore, setStore } from '@/app/lib/store';

// Única ruta de movimientos abierta al rol lector (transportistas): solo completar con Entregado/Recogido.
export const POST = withStoreErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getPublicUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Necesitas iniciar sesión.' }, { status: 401 });
  }
  if (user.rol !== 'editor' && user.rol !== 'lector') {
    return NextResponse.json({ error: 'Tu usuario no tiene un rol válido. Pide al administrador que lo corrija.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const accion = parseCompletionAction(body?.accion);
  if (!accion) {
    return NextResponse.json({ error: 'Indica la acción: entregado o recogido.' }, { status: 400 });
  }

  const { id } = await params;
  const state = await getStore();
  const result = completeMovementWithAction(state.movimientos, id, accion, user.nombre || user.email, new Date());
  if (!result.ok) {
    return result.error === 'not_found'
      ? NextResponse.json({ error: 'Movimiento no encontrado.' }, { status: 404 })
      : NextResponse.json({ error: 'Este movimiento ya estaba completado.' }, { status: 409 });
  }

  await setStore({ ...state, movimientos: result.movimientos });
  return NextResponse.json({ ok: true, movimiento: result.movimiento });
}, 'movimientos');
