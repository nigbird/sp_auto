import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Outgoing mail over SMTP, configured with SMTP_HOST / SMTP_PORT / SMTP_SECURE,
 * the login as SMTP_EMAIL_USER + SMTP_EMAIL_PASS (or SMTP_USER + SMTP_PASSWORD),
 * and optionally MAIL_FROM. EMAIL_ENABLED=false switches sending off. When
 * sending is off or SMTP_HOST isn't set, messages are written to the server
 * console instead, so links can still be followed by hand.
 */

let transporter: Transporter | null = null;

function smtpUser(): string | undefined {
  return (process.env.SMTP_EMAIL_USER || process.env.SMTP_USER)?.trim() || undefined;
}

function smtpPassword(): string | undefined {
  const pass = process.env.SMTP_EMAIL_PASS || process.env.SMTP_PASSWORD;
  // Gmail shows app passwords as "abcd efgh ijkl mnop"; the spaces aren't part of it.
  return pass ? pass.replace(/\s+/g, '') : undefined;
}

export function isEmailConfigured(): boolean {
  return process.env.EMAIL_ENABLED?.trim().toLowerCase() !== 'false' && !!process.env.SMTP_HOST;
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    const user = smtpUser();
    if (!user) console.warn('[email] SMTP_EMAIL_USER is not set — connecting without a login, which most servers (Gmail included) refuse.');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim(),
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE.trim() === 'true' : port === 465,
      auth: user ? { user, pass: smtpPassword() } : undefined,
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
    console.info(`[email] Sending is off (EMAIL_ENABLED=false or no SMTP_HOST) — not sending. To: ${email.to} | ${email.subject}\n${email.text}`);
    return false;
  }
  try {
    await getTransporter().sendMail({
      // Gmail rewrites any other sender to the signed-in account, so default to that account.
      from: process.env.MAIL_FROM || (smtpUser() ? `"Nib Strategic Plan" <${smtpUser()}>` : undefined),
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
