import { NextResponse } from 'next/server';
import { withStoreErrorHandling } from '@/app/lib/api-errors';
import { getEditorFromRequest } from '@/app/lib/auth';
import { hasGeneratorMovements } from '@/app/lib/generator-deletion';
import { getStore, setStore } from '@/app/lib/store';

export const DELETE = withStoreErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  if (!(await getEditorFromRequest(request))) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const { id } = await params;
  const state = await getStore();
  if (!state.generadores.some((generator) => generator.id === id)) {
    return NextResponse.json({ error: 'Generador no encontrado.' }, { status: 404 });
  }
  if (hasGeneratorMovements(state.movimientos, id)) {
    return NextResponse.json(
      { error: 'No se puede eliminar el generador porque tiene movimientos registrados.' },
      { status: 409 },
    );
  }

  await setStore({
    ...state,
    generadores: state.generadores.filter((generator) => generator.id !== id),
  });
  return NextResponse.json({ ok: true });
}, 'generadores');
