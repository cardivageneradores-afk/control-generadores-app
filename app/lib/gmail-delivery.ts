import {
  EmailConfigurationError,
  EmailDeliveryError,
  type SummaryEmailMessage,
} from './email-delivery.ts';

export const GMAIL_DAILY_RECIPIENT_LIMIT = 450;

export type GmailMail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type GmailSendMail = (mail: GmailMail) => Promise<{ messageId?: string } | void>;

export type RecipientFailure = { email: string; reason: string };

export type GmailDeliveryResult = {
  ok: true;
  mode: 'gmail';
  message: string;
  recipients: string[];
  sent: string[];
  failed: RecipientFailure[];
  partial: boolean;
};

// Only fixed, secret-free text is ever derived from a transport error.
export function describeGmailFailure(error: unknown) {
  const { code, responseCode } = (error && typeof error === 'object' ? error : {}) as {
    code?: unknown;
    responseCode?: unknown;
  };
  if (code === 'EAUTH' || responseCode === 535) {
    return 'Gmail rechazó las credenciales (revisa GMAIL_USER y GMAIL_APP_PASSWORD).';
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION' || code === 'ECONNRESET') {
    return 'No se pudo conectar con Gmail a tiempo.';
  }
  if (code === 'EENVELOPE' || (typeof responseCode === 'number' && responseCode >= 550 && responseCode < 560)) {
    return 'Gmail rechazó la dirección destinataria.';
  }
  if (typeof responseCode === 'number' && responseCode >= 400 && responseCode < 500) {
    return 'Gmail limitó temporalmente el envío (posible límite diario).';
  }
  return 'Error inesperado al enviar con Gmail.';
}

export async function deliverSummaryViaGmail({
  user,
  message,
  sendMail,
}: {
  user: string;
  message: SummaryEmailMessage;
  sendMail: GmailSendMail;
}): Promise<GmailDeliveryResult> {
  const recipients = [...new Set(message.to)];
  if (recipients.length > GMAIL_DAILY_RECIPIENT_LIMIT) {
    throw new EmailConfigurationError(
      `Hay ${recipients.length} destinatarios y Gmail permite unos 500 envíos al día. Reduce la lista a ${GMAIL_DAILY_RECIPIENT_LIMIT} o menos.`,
    );
  }

  const sent: string[] = [];
  const failed: RecipientFailure[] = [];
  // One message per recipient so nobody sees the other addresses.
  for (const recipient of recipients) {
    try {
      await sendMail({
        from: `Control Generadores <${user}>`,
        to: recipient,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      sent.push(recipient);
    } catch (error) {
      failed.push({ email: recipient, reason: describeGmailFailure(error) });
    }
  }

  if (!sent.length) {
    const reasons = [...new Set(failed.map((item) => item.reason))].join(' ');
    throw new EmailDeliveryError(`No se pudo enviar el resumen a ningún destinatario. ${reasons}`);
  }

  return {
    ok: true,
    mode: 'gmail',
    message: failed.length
      ? `Resumen enviado a ${sent.length} de ${recipients.length} destinatarios. Fallaron: ${failed.map((item) => item.email).join(', ')}.`
      : 'Email enviado correctamente.',
    recipients,
    sent,
    failed,
    partial: failed.length > 0,
  };
}
