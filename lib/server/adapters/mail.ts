import { Resend } from 'resend'
import { env } from '@/lib/env'

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

/**
 * Send a magic-link login email to the user.
 *
 * In development, when RESEND_API_KEY is absent, the link is logged to the
 * console so Mailpit (or any local SMTP catcher) can surface it.
 */
export async function sendMagicLinkEmail(
  email: string,
  magicLink: string,
  language: 'en' | 'bn',
): Promise<void> {
  if (!resend) {
    // Development fallback — Mailpit will catch any SMTP traffic separately
    console.log(`[DEV] Magic link for ${email}: ${magicLink}`)
    return
  }

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

  await resend.emails.send({
    from: 'Vesta <noreply@vesta.app>',
    to: email,
    subject,
    html,
  })
}
