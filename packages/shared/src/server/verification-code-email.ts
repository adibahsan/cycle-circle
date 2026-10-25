import type { Language } from '@prisma/client'
import { EMAIL_PALETTE as P, emailContactHtml, emailHeaderHtml } from './email-templates'

export function buildVerificationCodeEmailHtml(
  code: string,
  language: 'en' | 'bn' | Language,
): { subject: string; html: string } {
  const isBn = language === 'bn' || language === 'BN'
  const langAttr = isBn ? 'bn' : 'en'
  const subject = isBn ? 'আপনার সাইকেল সার্কেল যাচাইকরণ কোড' : 'Your Cycle Circle verification code'
  const intro = isBn ? `আপনার কোড ${code}।` : `Your code is ${code}.`
  const rest = isBn
    ? 'এটি ১০ মিনিটে মেয়াদোত্তীর্ণ হবে। আপনি এটি না চাইলে ইমেইলটি উপেক্ষা করুন।'
    : "It expires in 10 minutes. If you didn't ask for this, ignore this email."

  const html = `<!DOCTYPE html>
<html lang="${langAttr}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:${P.bg};margin:0;padding:32px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;margin:0 auto;background:${P.card};border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(26,35,44,0.08);">
    <tr>
      ${emailHeaderHtml(langAttr, isBn ? 'আপনার স্বাস্থ্য সঙ্গী' : 'Your cycle companion')}
    </tr>
    <tr><td style="padding:32px;">
      <p style="color:${P.ink};font-size:16px;margin:0 0 16px;">${intro}</p>
      <p style="color:${P.ink};font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 24px;font-variant-numeric:tabular-nums;">${code}</p>
      <p style="color:${P.muted};font-size:13px;margin:0;">${rest}</p>
    </td></tr>
    <tr><td style="padding:16px 32px 24px;border-top:1px solid ${P.border};">
      ${emailContactHtml(langAttr)}
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}
