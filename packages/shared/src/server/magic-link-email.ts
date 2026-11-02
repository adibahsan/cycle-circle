import type { Language } from '@prisma/client'
import { EMAIL_PALETTE as P, emailContactHtml, emailHeaderHtml } from './email-templates'
import { MAGIC_LINK_TTL_MS, durationText } from '../utils/auth-ttl'

export function buildMagicLinkEmailHtml(
  magicLink: string,
  language: 'en' | 'bn' | Language,
): { subject: string; html: string } {
  const isBn = language === 'bn' || language === 'BN'
  const langAttr = isBn ? 'bn' : 'en'
  const subject = isBn ? 'সাইকেল সার্কেল - লগইন লিঙ্ক' : 'Cycle Circle - Login Link'
  const intro = isBn ? 'আপনার লগইন লিঙ্ক' : 'Your login link'
  const buttonLabel = isBn ? 'লগইন করুন' : 'Sign in to Cycle Circle'
  const ttl = durationText(MAGIC_LINK_TTL_MS, isBn ? 'bn' : 'en')
  const expiry = isBn ? `এই লিঙ্কটি ${ttl} পর্যন্ত বৈধ।` : `This link will expire in ${ttl}.`

  const html = `<!DOCTYPE html>
<html lang="${langAttr}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:${P.bg};margin:0;padding:32px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;margin:0 auto;background:${P.card};border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(26,35,44,0.08);">
    <tr>
      ${emailHeaderHtml(langAttr, isBn ? 'আপনার স্বাস্থ্য সঙ্গী' : 'Your cycle companion')}
    </tr>
    <tr><td style="padding:32px;">
      <p style="color:${P.ink};font-size:16px;margin:0 0 24px;">${intro}:</p>
      <a href="${magicLink}"
         style="display:inline-block;background:${P.cta};color:${P.onCta};text-decoration:none;padding:14px 28px;border-radius:999px;font-size:15px;font-weight:600;">
        ${buttonLabel}
      </a>
      <p style="color:${P.muted};font-size:13px;margin:24px 0 0;">${expiry}</p>
      <p style="color:${P.muted};font-size:12px;margin:8px 0 0;word-break:break-all;">
        ${magicLink}
      </p>
    </td></tr>
    <tr><td style="padding:16px 32px 24px;border-top:1px solid ${P.border};">
      ${emailContactHtml(langAttr)}
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}
