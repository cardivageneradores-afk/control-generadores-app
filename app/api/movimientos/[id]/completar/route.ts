import { NextResponse } from 'next/server';
import { withStoreErrorHandling } from '@/app/lib/api-errors';
import { getEditorFromRequest } from '@/app/lib/auth';
import { getStore, setStore } from '@/app/lib/store';

export const POST = withStoreErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  if (!(await getEditorFromRequest(request))) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const { id } = await params;
  const state = await getStore();
  const completedAt = new Date().toISOString();
  const next = {
    ...state,
    movimientos: state.movimientos.map((movement) =>
      movement.id === id
        ? {
            ...movement,
            estado: 'completado' as const,
            completado_en: completedAt,
            editado_en: completedAt,
          }
        : movement,
    ),
  };

  await setStore(next);
  return NextResponse.json({ ok: true, movimiento: next.movimientos.find((movement) => movement.id === id) });
}, 'movimientos');
