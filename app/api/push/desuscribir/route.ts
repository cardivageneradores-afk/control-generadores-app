import { NextResponse } from 'next/server';
import { getPublicUserFromRequest } from '@/app/lib/auth';
import { removeSubscriptions } from '@/app/lib/push-store';

// Cualquier usuario con sesión puede borrar solo sus propias suscripciones.
export async function POST(request: Request) {
  const user = await getPublicUserFromRequest(request).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: 'Necesitas iniciar sesión.' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (typeof endpoint !== 'string' || !endpoint || endpoint.length > 2048) {
    return NextResponse.json({ error: 'Suscripción no válida.' }, { status: 400 });
  }
  try {
    await removeSubscriptions([endpoint], user.email);
  } catch {
    return NextResponse.json({ error: 'No se pudo desactivar.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
