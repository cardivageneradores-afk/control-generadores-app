import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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
      ? async (email) => {
        if (!email.html.includes('src="cid:cardiva-logo"')) {
          return resend.emails.send(email);
        }
        const logo = await readFile(join(process.cwd(), 'public', 'cardiva-logo.png'));
        return resend.emails.send({
          ...email,
          attachments: [{
            content: logo.toString('base64'),
            filename: 'cardiva-logo.png',
            contentId: 'cardiva-logo',
          }],
        });
      }
      : undefined,
  });
}
