export type SummaryEmailMessage = {
  to: string[];
  subject: string;
  html: string;
  text: string;
};

type SendResult = {
  data?: { id?: string } | null;
  error?: { message: string } | null;
};

type SendEmail = (message: SummaryEmailMessage & { from: string }) => Promise<SendResult>;

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailConfigurationError';
  }
}

export class EmailDeliveryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'EmailDeliveryError';
  }
}

export async function deliverSummaryEmail({
  apiKey,
  from,
  allowDemo,
  message,
  send,
}: {
  apiKey?: string;
  from?: string;
  allowDemo: boolean;
  message: SummaryEmailMessage;
  send?: SendEmail;
}) {
  if (!apiKey || !from) {
    if (allowDemo) {
      return {
        ok: true,
        mode: 'demo',
        message: 'Envío simulado en desarrollo.',
        recipients: message.to,
      };
    }

    const missing = [
      ...(!apiKey ? ['RESEND_API_KEY'] : []),
      ...(!from ? ['RESEND_FROM_EMAIL'] : []),
    ];
    throw new EmailConfigurationError(
      `Resend no está configurado. Define ${missing.join(' y ')} y utiliza un remitente de un dominio verificado.`,
    );
  }
  if (!send) {
    throw new EmailConfigurationError('No se pudo inicializar Resend. Comprueba RESEND_API_KEY y reinicia la aplicación.');
  }

  let result: SendResult;
  try {
    result = await send({ ...message, from });
  } catch (error) {
    throw new EmailDeliveryError(
      'No se pudo conectar con Resend. Comprueba la conexión del servidor y el estado del servicio.',
      { cause: error },
    );
  }

  if (result.error) {
    throw new EmailDeliveryError(
      `Resend rechazó el envío: ${result.error.message} Comprueba la API key, el dominio remitente verificado y las direcciones destinatarias.`,
    );
  }
  if (!result.data?.id) {
    throw new EmailDeliveryError(
      'Resend no confirmó la aceptación del email. Revisa los registros del servidor y el estado de Resend antes de volver a enviarlo.',
    );
  }

  return {
    ok: true,
    mode: 'resend',
    message: 'Email enviado correctamente.',
    id: result.data.id,
    recipients: message.to,
  };
}
