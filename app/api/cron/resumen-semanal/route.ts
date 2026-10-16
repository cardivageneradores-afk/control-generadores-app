import { NextResponse } from 'next/server';
import { withStoreErrorHandling } from '@/app/lib/api-errors';
import { sendSummaryEmail } from '@/app/lib/email';
import { EmailConfigurationError, EmailDeliveryError } from '@/app/lib/email-delivery';
import { getStore } from '@/app/lib/store';
import { supabaseAdmin } from '@/app/lib/supabase';
import { buildWeeklyMovementEmail } from '@/app/lib/weekly-movement-email';
import { getMadridWeekStart, isAuthorizedCronRequest } from '@/app/lib/weekly-cron';

export const dynamic = 'force-dynamic';

export const GET = withStoreErrorHandling(async (request: Request) => {
  if (!isAuthorizedCronRequest(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase no está configurado.' }, { status: 503 });
  }

  const state = await getStore();
  if (!state.destinatarios.length) {
    return NextResponse.json({ ok: true, skipped: 'sin-destinatarios' });
  }

  const now = new Date();
  const weekStart = getMadridWeekStart(now);
  const claim = await supabaseAdmin.from('weekly_email_runs').insert({ week_start: weekStart });
  if (claim.error) {
    if (claim.error.code === '23505') {
      return NextResponse.json({ ok: true, skipped: 'ya-enviado', weekStart });
    }
    console.error('[cron-resumen-semanal] No se pudo registrar la marca semanal', claim.error.code);
    return NextResponse.json({
      error: 'No se pudo registrar el envío semanal. Aplica la migración weekly_email_runs en Supabase.',
    }, { status: 503 });
  }

  const { subjectDateRange, ...summary } = buildWeeklyMovementEmail(state.movimientos, state.generadores, now, {
    sender: { nombre: 'Envío automático semanal', email: process.env.GMAIL_USER?.trim() || 'sistema' },
    logoCid: 'cardiva-logo',
  });

  try {
    const response = await sendSummaryEmail({
      to: state.destinatarios,
      subject: `Resumen semanal de control de generadores · ${subjectDateRange}`,
      ...summary,
    });
    const failed = 'failed' in response && Array.isArray(response.failed) ? response.failed.length : 0;
    const update = await supabaseAdmin.from('weekly_email_runs').update({
      sent_at: new Date().toISOString(),
      recipients_total: state.destinatarios.length,
      recipients_failed: failed,
    }).eq('week_start', weekStart);
    if (update.error) console.error('[cron-resumen-semanal] No se pudo cerrar la marca semanal', update.error.code);
    return NextResponse.json({ ...response, weekStart });
  } catch (error) {
    // Nothing was delivered, so release the claim to allow a retry.
    await supabaseAdmin.from('weekly_email_runs').delete().eq('week_start', weekStart);
    if (error instanceof EmailConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof EmailDeliveryError) {
      console.error('[cron-resumen-semanal] Envío fallido:', error.message);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error('[cron-resumen-semanal] Fallo inesperado de envío');
    return NextResponse.json({ error: 'Error inesperado al enviar el resumen.' }, { status: 500 });
  }
}, 'cron-resumen-semanal');
