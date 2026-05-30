import { createTransport } from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { Resend } from 'resend'
import type { EmailType } from '@prisma/client'
import { env } from '../../utils/env'
import { prisma } from '../db'

// ─── Constants ────────────────────────────────────────────────────────────────

const EMAIL_FROM = env.RESEND_FROM_EMAIL

// ─── Resend client (null in dev when RESEND_API_KEY is absent) ────────────────

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

// ─── SMTP transport (lazy, cached) ───────────────────────────────────────────

let _smtpTransport: Transporter | null = null

function parseSmtpUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 1025,
  }
}

function getSmtpTransport(): Transporter {
  if (!_smtpTransport) {
    const { host, port } = parseSmtpUrl(env.MAILPIT_SMTP_URL)
    _smtpTransport = createTransport({
      host,
      port,
      secure: false,
      tls: { rejectUnauthorized: false },
    })
  }
  return _smtpTransport
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type EmailMeta = {
  type: EmailType
  userId?: string
  profileId?: string
}

// ─── Generic email sender ─────────────────────────────────────────────────────

/**
 * Send an email via Resend (production) or Mailpit SMTP (development).
 * Every send attempt — success or failure — is persisted to `EmailLog`.
 *
 * `meta` is optional; when omitted the log entry defaults to type MAGIC_LINK.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  meta?: EmailMeta,
): Promise<void> {
  const type: EmailType = meta?.type ?? 'MAGIC_LINK'
  const provider = resend ? 'RESEND' : 'SMTP'

  try {
    let resendId: string | undefined

    if (resend) {
      const { data } = await resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject,
        html,
      })
      resendId = data?.id ?? undefined
    } else {
      await getSmtpTransport().sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        html,
      })
    }

    await prisma.emailLog.create({
      data: {
        type,
        to,
        subject,
        status: 'SENT',
        provider,
        resendId,
        userId: meta?.userId,
        profileId: meta?.profileId,
      },
    })
  } catch (err) {
    await prisma.emailLog.create({
      data: {
        type,
        to,
        subject,
        status: 'FAILED',
        provider,
        error: String(err),
        userId: meta?.userId,
        profileId: meta?.profileId,
      },
    })
    throw err
  }
}

// ─── Magic-link email ─────────────────────────────────────────────────────────

/**
 * Send a magic-link login email to the user.
 *
 * In development (no RESEND_API_KEY), the email is delivered to Mailpit via
 * SMTP and also persisted to EmailLog.
 */
export async function sendMagicLinkEmail(
  email: string,
  magicLink: string,
  language: 'en' | 'bn',
): Promise<void> {
  const isBn = language === 'bn'
  const subject = isBn ? 'ভেস্তা - লগইন লিঙ্ক' : 'Vesta - Login Link'
  const intro = isBn ? 'আপনার লগইন লিঙ্ক' : 'Your login link'
  const buttonLabel = isBn ? 'লগইন করুন' : 'Sign in to Vesta'
  const expiry = isBn
    ? 'এই লিঙ্কটি ১৫ মিনিটের মধ্যে মেয়াদ শেষ হবে।'
    : 'This link will expire in 15 minutes.'

  const html = `<!DOCTYPE html>
<html lang="${language}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="font-family:system-ui,sans-serif;background:#f9f5f1;margin:0;padding:32px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <tr><td style="background:#e87b9e;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Vesta</h1>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="color:#333;font-size:16px;margin:0 0 24px;">${intro}:</p>
      <a href="${magicLink}"
         style="display:inline-block;background:#e87b9e;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
        ${buttonLabel}
      </a>
      <p style="color:#888;font-size:13px;margin:24px 0 0;">${expiry}</p>
      <p style="color:#aaa;font-size:12px;margin:8px 0 0;word-break:break-all;">
        ${magicLink}
      </p>
    </td></tr>
  </table>
</body>
</html>`

  await sendEmail(email, subject, html, { type: 'MAGIC_LINK' })
}
