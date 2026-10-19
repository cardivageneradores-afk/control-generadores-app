import { NextResponse } from 'next/server';
import { withStoreErrorHandling } from '@/app/lib/api-errors';
import { getEditorFromRequest } from '@/app/lib/auth';
import { hasGeneratorMovements } from '@/app/lib/generator-deletion';
import { getStore, setStore } from '@/app/lib/store';
import { normalizeLocation } from '@/app/lib/generator-location';

export const PATCH = withStoreErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  if (!(await getEditorFromRequest(request))) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.ubicacion !== 'string' || !body.ubicacion.trim()) {
    return NextResponse.json({ error: 'Indica la ubicación fija del generador.' }, { status: 400 });
  }

  const { id } = await params;
  const state = await getStore();
  if (!state.generadores.some((generator) => generator.id === id)) {
    return NextResponse.json({ error: 'Generador no encontrado.' }, { status: 404 });
  }

  const ubicacion = normalizeLocation(body.ubicacion);
  const generadores = state.generadores.map((generator) => (generator.id === id ? { ...generator, ubicacion } : generator));
  await setStore({ ...state, generadores });
  return NextResponse.json({ ok: true, generador: generadores.find((generator) => generator.id === id) });
}, 'generadores');

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
