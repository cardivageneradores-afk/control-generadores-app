import 'server-only';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const from = process.env.RESEND_FROM_EMAIL;

export async function sendSummaryEmail({
  to, subject, html, text,
}: { to: string[]; subject: string; html: string; text: string }) {
  if (!resend || !from) {
    if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_EMAIL === 'true') {
      return { ok: true, mode: 'demo', message: 'Envío simulado en desarrollo.', recipients: to };
    }
    throw new Error('Resend no está configurado. Define RESEND_API_KEY y RESEND_FROM_EMAIL.');
  }
  const result = await resend.emails.send({ from, to, subject, html, text });
  if (result.error) throw new Error(`Resend rechazó el envío: ${result.error.message}`);
  return { ok: true, mode: 'resend', message: 'Email enviado correctamente.', id: result.data?.id ?? null, recipients: to };
}
