import 'server-only';
import { Resend } from 'resend';
import { deliverSummaryEmail } from './email-delivery';
import type { SummaryEmailMessage } from './email-delivery';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const from = process.env.RESEND_FROM_EMAIL;

export function sendSummaryEmail(message: SummaryEmailMessage) {
  return deliverSummaryEmail({
    apiKey: process.env.RESEND_API_KEY,
    from,
    allowDemo: process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_EMAIL === 'true',
    message,
    send: resend && from
      ? (email) => resend.emails.send(email)
      : undefined,
  });
}
