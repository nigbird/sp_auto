import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Outgoing mail over SMTP, configured with SMTP_HOST / SMTP_PORT / SMTP_USER /
 * SMTP_PASSWORD / SMTP_SECURE and MAIL_FROM. When SMTP_HOST isn't set (local
 * development) messages are written to the server console instead, so links
 * can still be followed by hand.
 */

let transporter: Transporter | null = null;

export function isEmailConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends the message; returns false (never throws) if it could not be delivered. */
export async function sendEmail(email: Email): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.info(`[email] SMTP_HOST is not set — not sending. To: ${email.to} | ${email.subject}\n${email.text}`);
    return false;
  }
  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      ...email,
    });
    return true;
  } catch (error) {
    console.error(`[email] Failed to send "${email.subject}" to ${email.to}`, error);
    return false;
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
