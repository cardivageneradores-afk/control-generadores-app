import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { deliverSummaryViaGmail } from './gmail-delivery';
import { deliverSummaryEmail } from './email-delivery';
import type { SummaryEmailMessage } from './email-delivery';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const from = process.env.RESEND_FROM_EMAIL;

function sendViaGmail(user: string, pass: string, message: SummaryEmailMessage) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return deliverSummaryViaGmail({
    user,
    message,
    sendMail: async (mail) => {
      const needsLogo = mail.html.includes('src="cid:cardiva-logo"');
      const logo = needsLogo ? await readFile(join(process.cwd(), 'public', 'cardiva-logo.png')) : null;
      await transporter.sendMail({
        ...mail,
        ...(logo ? {
          attachments: [{
            filename: 'cardiva-logo.png',
            content: logo,
            cid: 'cardiva-logo',
            contentType: 'image/png',
            contentDisposition: 'inline' as const,
          }],
        } : {}),
      });
    },
  }).finally(() => transporter.close());
}

export function sendSummaryEmail(message: SummaryEmailMessage) {
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  if (gmailUser && gmailPassword) {
    return sendViaGmail(gmailUser, gmailPassword, message);
  }

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
