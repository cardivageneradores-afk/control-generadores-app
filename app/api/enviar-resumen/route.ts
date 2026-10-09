import { NextResponse } from 'next/server';
import { withStoreErrorHandling } from '@/app/lib/api-errors';
import { getEditorFromRequest } from '@/app/lib/auth';
import { getStore } from '@/app/lib/store';
import { EmailConfigurationError, EmailDeliveryError } from '@/app/lib/email-delivery';
import { sendSummaryEmail } from '@/app/lib/email';
import { buildWeeklyMovementEmail } from '@/app/lib/weekly-movement-email';

export const POST = withStoreErrorHandling(async (request: Request) => {
  if (!(await getEditorFromRequest(request))) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const state = await getStore();
  if (!state.destinatarios.length) {
    return NextResponse.json({ error: 'Configura al menos un destinatario antes de enviar el resumen.' }, { status: 400 });
  }
  const recipients = state.destinatarios;

  const summary = buildWeeklyMovementEmail(state.movimientos, state.generadores);

  try {
    const response = await sendSummaryEmail({
      to: recipients,
      subject: 'Resumen semanal de control de generadores',
      ...summary,
    });
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof EmailConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof EmailDeliveryError) {
      console.error('[enviar-resumen] Resend delivery failed', error.message, error.cause);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    console.error('[enviar-resumen] Unexpected email delivery failure', error);
    return NextResponse.json({
      error: 'No se pudo enviar el resumen por un error inesperado. Revisa los registros del servidor.',
    }, { status: 500 });
  }
}, 'enviar-resumen');
