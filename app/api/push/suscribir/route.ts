import { NextResponse } from 'next/server';
import { getEditorFromRequest } from '@/app/lib/auth';
import { isValidSubscriptionInput } from '@/app/lib/push';
import { pushEnabled, saveSubscription } from '@/app/lib/push-store';

export async function POST(request: Request) {
  const user = await getEditorFromRequest(request).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }
  if (!pushEnabled()) {
    return NextResponse.json({ error: 'Las notificaciones no están configuradas.' }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  if (!isValidSubscriptionInput(body?.subscription)) {
    return NextResponse.json({ error: 'Suscripción no válida.' }, { status: 400 });
  }
  try {
    await saveSubscription({
      email: user.email,
      endpoint: body.subscription.endpoint,
      p256dh: body.subscription.keys.p256dh,
      auth: body.subscription.keys.auth,
      userAgent: request.headers.get('user-agent'),
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar la suscripción.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
