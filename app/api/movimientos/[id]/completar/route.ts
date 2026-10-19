import { NextResponse } from 'next/server';
import { withStoreErrorHandling } from '@/app/lib/api-errors';
import { getPublicUserFromRequest } from '@/app/lib/auth';
import { applyCompletionLocation, completeMovementWithAction, parseCompletionAction } from '@/app/lib/movement-completion';
import { buildCompletionPayload, selectEditorEmails } from '@/app/lib/push';
import { notifyEditors } from '@/app/lib/push-store';
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
      : result.error === 'already_delivered'
        ? NextResponse.json({ error: 'Este movimiento ya estaba entregado; solo queda marcarlo como recogido.' }, { status: 409 })
      : NextResponse.json({ error: 'Este movimiento ya estaba completado.' }, { status: 409 });
  }

  await setStore({ ...state, movimientos: result.movimientos, generadores: applyCompletionLocation(state.generadores, result.movimiento) });

  // Notificación push best-effort: nunca bloquea ni hace fallar la acción ya guardada.
  try {
    const moved = result.movimiento;
    const code = state.generadores.find((generator) => generator.id === moved.generador_id)?.codigo ?? '?';
    await notifyEditors(
      selectEditorEmails(state.usuarios, user.email),
      buildCompletionPayload({
        movementId: moved.id,
        generatorCode: code,
        action: accion,
        origin: moved.origen,
        destination: moved.destino,
        completedBy: user.nombre || user.email,
        now: new Date(),
      }),
    );
  } catch {
    // ignorado a propósito
  }
  return NextResponse.json({ ok: true, movimiento: result.movimiento });
}, 'movimientos');
