import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendSummaryEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}) {
  if (!resend) {
    return {
      ok: true,
      mode: 'demo',
      message: 'Se ha simulado el envío porque no hay API key de Resend configurada.',
      recipients: to,
    };
  }

  const result = await resend.emails.send({
    from: 'Control Generadores <onboarding@resend.dev>',
    to,
    subject,
    html,
    text,
  });

  return {
    ok: true,
    mode: 'resend',
    message: 'Email enviado correctamente.',
    id: result.data?.id ?? null,
    recipients: to,
  };
}
