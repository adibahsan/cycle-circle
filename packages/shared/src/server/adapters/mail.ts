import { createTransport } from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { Resend } from 'resend'
import type { EmailType } from '@prisma/client'
import { env } from '../../utils/env'
import { prisma } from '../db'
import { buildMagicLinkEmailHtml } from '../magic-link-email'
import { buildVerificationCodeEmailHtml } from '../verification-code-email'

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
  /** Plain-text mail body, sent beside the HTML. */
  text?: string
  attachments?: { filename: string; content: string; contentType?: string }[]
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

  // Dev: surface the email in the same console as the dev SMS logs. Delivery
  // still proceeds below (to Mailpit when RESEND_API_KEY is absent).
  if (env.DEV_MODE || env.NODE_ENV === 'development') {
    console.log('[EMAIL][dev] →', to, '|', subject, `(${provider})`)
  }

  try {
    let resendId: string | undefined

    if (resend) {
      const { data } = await resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject,
        html,
        text: meta?.text,
        attachments: meta?.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content, 'utf8') })),
      })
      resendId = data?.id ?? undefined
    } else {
      await getSmtpTransport().sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        html,
        text: meta?.text,
        attachments: meta?.attachments,
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

// ─── Verification-code email ──────────────────────────────────────────────────

/** Send the 6-digit code that proves a signed-in user owns `email` before it is saved. */
export async function sendVerificationCodeEmail(
  email: string,
  code: string,
  language: 'en' | 'bn',
  userId?: string,
): Promise<void> {
  const { subject, html } = buildVerificationCodeEmailHtml(code, language)
  await sendEmail(email, subject, html, { type: 'VERIFICATION_CODE', userId })
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
  const { subject, html } = buildMagicLinkEmailHtml(magicLink, language)
  await sendEmail(email, subject, html, { type: 'MAGIC_LINK' })
}
