import { NextResponse } from 'next/server';
import { withStoreErrorHandling } from '@/app/lib/api-errors';
import { getEditorFromRequest } from '@/app/lib/auth';
import { getStore } from '@/app/lib/store';
import { EmailConfigurationError, EmailDeliveryError } from '@/app/lib/email-delivery';
import { sendSummaryEmail } from '@/app/lib/email';
import { buildWeeklyMovementEmail, buildWeeklyMovementSubject } from '@/app/lib/weekly-movement-email';
import { getWeekStartDate, isValidWeekStart } from '@/app/lib/calendar-week';

export const POST = withStoreErrorHandling(async (request: Request) => {
  const editor = await getEditorFromRequest(request);
  if (!editor) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const state = await getStore();
  if (!state.destinatarios.length) {
    return NextResponse.json({ error: 'Configura al menos un destinatario antes de enviar el resumen.' }, { status: 400 });
  }
  const recipients = state.destinatarios;
  let weekStart: Date;
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || !isValidWeekStart(body.weekStart)) {
      return NextResponse.json({ error: 'La semana debe comenzar en un lunes válido.' }, { status: 400 });
    }
    weekStart = getWeekStartDate(body.weekStart);
  } catch {
    return NextResponse.json({ error: 'Indica el lunes de inicio de la semana que quieres enviar.' }, { status: 400 });
  }

  const { subjectDateRange, ...summary } = buildWeeklyMovementEmail(state.movimientos, state.generadores, weekStart, {
    sender: editor,
    logoCid: 'cardiva-logo',
  });

  try {
    const response = await sendSummaryEmail({
      to: recipients,
      subject: buildWeeklyMovementSubject(subjectDateRange),
      ...summary,
    });
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof EmailConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof EmailDeliveryError) {
      console.error('[enviar-resumen] Email delivery failed', error.message);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    console.error('[enviar-resumen] Unexpected email delivery failure', error);
    return NextResponse.json({
      error: 'No se pudo enviar el resumen por un error inesperado. Revisa los registros del servidor.',
    }, { status: 500 });
  }
}, 'enviar-resumen');
