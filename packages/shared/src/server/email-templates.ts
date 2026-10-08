import type { Language } from '@prisma/client'

// ─── Template data types ──────────────────────────────────────────────────────

interface TemplateData {
  userName: string
  profileName: string
  language: Language
}

export interface PeriodAlertData extends TemplateData {
  predictedDate: string
  daysUntil: number
}

export interface FertileWindowData extends TemplateData {
  fertileStart: string
  fertileEnd: string
  ovulationDate: string
}

export interface LoggingReminderData extends TemplateData {
  daysSinceLastLog: number
}

export interface ProfileCompletionReminderData {
  userName: string
  language: Language
}

export interface EmailResult {
  subject: string
  html: string
}

// ─── Brand palette (inline hex only: email clients do not support CSS vars) ───
// Mirrors the Cycle Circle light-theme tokens in apps/web/src/app/globals.css.

export const EMAIL_PALETTE = {
  cta: '#D02F58', // --color-action / --color-primary
  onCta: '#FFFFFF', // --color-on-action
  bg: '#FFF7F8', // --color-bg-primary
  card: '#FFFFFF', // --color-bg-card
  peach: '#FDF0E6', // --color-bg-peach
  ink: '#1A232C', // --color-text-primary
  muted: '#565266', // --color-text-secondary
  border: '#F6DDE3', // --color-border
  goldInk: '#8C6A1F', // --color-gold-ink
} as const

const P = EMAIL_PALETTE

export const EMAIL_CONTACT = 'info@cycle-circle.com'

export const EMAIL_LOGO_WIDTH = 160

function appBaseUrl(): string {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
}

export function emailLogoUrl(): string {
  return `${appBaseUrl()}/brand/cycle-circle-logo.png`
}

/** Shared header block: centred circular logo on a white card. */
export function emailHeaderHtml(lang: 'en' | 'bn', tagline?: string): string {
  const alt = 'Cycle Circle'
  const sub = tagline ?? (lang === 'bn' ? 'আপনার স্বাস্থ্য সঙ্গী' : 'Your cycle companion')
  return `<td align="center" style="background:${P.card};padding:28px 32px 20px;border-bottom:1px solid ${P.border};">
              <img src="${emailLogoUrl()}" width="${EMAIL_LOGO_WIDTH}" alt="${alt}" style="display:block;margin:0 auto;border:0;outline:none;height:auto;max-width:${EMAIL_LOGO_WIDTH}px;" />
              <p style="margin:12px 0 0;color:${P.muted};font-size:13px;">${sub}</p>
            </td>`
}

/** Shared footer contact line. */
export function emailContactHtml(lang: 'en' | 'bn'): string {
  const label = lang === 'bn' ? 'যোগাযোগ' : 'Contact'
  return `<p style="margin:8px 0 0;color:${P.muted};font-size:12px;line-height:1.6;">${label}: <a href="mailto:${EMAIL_CONTACT}" style="color:${P.cta};text-decoration:underline;">${EMAIL_CONTACT}</a></p>`
}

// ─── Shared layout wrapper ────────────────────────────────────────────────────

function wrapLayout(lang: Language, bodyContent: string): string {
  const dir = lang === 'BN' ? 'ltr' : 'ltr'
  return `<!DOCTYPE html>
<html lang="${lang === 'BN' ? 'bn' : 'en'}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
</head>
<body style="margin:0;padding:0;background:${P.bg};font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="background:${P.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width:600px;background:${P.card};border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(26,35,44,0.08);">

          <!-- Header -->
          <tr>
            ${emailHeaderHtml(lang === 'BN' ? 'bn' : 'en')}
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid ${P.border};">
              <p style="margin:0;color:${P.muted};font-size:12px;line-height:1.6;">
                ${lang === 'BN'
    ? 'এই ইমেইল পাচ্ছেন কারণ আপনি সাইকেল সার্কেলে নোটিফিকেশন চালু রেখেছেন। নোটিফিকেশন বন্ধ করতে অ্যাপের সেটিংসে যান।'
    : 'You received this email because you have notifications enabled in Cycle Circle. To unsubscribe, visit Settings in the app.'}
              </p>
              ${emailContactHtml(lang === 'BN' ? 'bn' : 'en')}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Period Alert ─────────────────────────────────────────────────────────────

export function periodAlertEmail(data: PeriodAlertData): EmailResult {
  const { userName, profileName, language, predictedDate, daysUntil } = data
  const isBn = language === 'BN'

  const subject = isBn
    ? `সাইকেল সার্কেল: আপনার পিরিয়ড ${daysUntil} দিনের মধ্যে আসবে`
    : `Cycle Circle: Your period is expected in ${daysUntil} days`

  const greeting = isBn
    ? `হ্যালো ${userName},`
    : `Hi ${userName},`

  const profileLine = isBn
    ? `<strong>${profileName}</strong> এর জন্য একটি আপডেট আছে।`
    : `Here's an update for <strong>${profileName}</strong>.`

  const headingText = isBn
    ? 'পিরিয়ড পূর্বাভাস'
    : 'Period Prediction'

  const daysLabel = isBn
    ? `${daysUntil} দিনের মধ্যে`
    : `in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`

  const dateLabel = isBn
    ? `প্রত্যাশিত তারিখ: ${predictedDate}`
    : `Expected date: ${predictedDate}`

  const tipText = isBn
    ? 'প্রস্তুত থাকুন — স্যানিটারি পণ্য ও ব্যথানাশক ওষুধ হাতের কাছে রাখুন। পর্যাপ্ত পানি পান করুন এবং হালকা ব্যায়াম করুন।'
    : 'Be prepared — keep sanitary products and pain relief nearby. Stay hydrated and try some light exercise to ease any discomfort.'

  const tipLabel = isBn ? 'টিপস' : 'Helpful tip'

  const body = `
    <p style="margin:0 0 4px;color:${P.muted};font-size:16px;font-weight:500;">${greeting}</p>
    <p style="margin:0 0 28px;color:${P.muted};font-size:15px;">${profileLine}</p>

    <!-- Alert card -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${P.bg};border-left:4px solid ${P.cta};border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 6px;color:${P.cta};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">
            ${headingText}
          </p>
          <p style="margin:0 0 4px;color:${P.ink};font-size:22px;font-weight:700;">${daysLabel}</p>
          <p style="margin:0;color:${P.muted};font-size:14px;">${dateLabel}</p>
        </td>
      </tr>
    </table>

    <!-- Tip card -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${P.peach};border-radius:8px;margin-bottom:8px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 6px;color:${P.ink};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">
            ${tipLabel}
          </p>
          <p style="margin:0;color:${P.ink};font-size:14px;line-height:1.6;">${tipText}</p>
        </td>
      </tr>
    </table>
  `

  return { subject, html: wrapLayout(language, body) }
}

// ─── Fertile Window Alert ─────────────────────────────────────────────────────

export function fertileWindowEmail(data: FertileWindowData): EmailResult {
  const { userName, profileName, language, fertileStart, fertileEnd, ovulationDate } = data
  const isBn = language === 'BN'

  const subject = isBn
    ? 'সাইকেল সার্কেল: আপনার উর্বর সময় আজ শুরু'
    : 'Cycle Circle: Your fertile window starts today'

  const greeting = isBn
    ? `হ্যালো ${userName},`
    : `Hi ${userName},`

  const profileLine = isBn
    ? `<strong>${profileName}</strong> এর জন্য একটি গুরুত্বপূর্ণ আপডেট।`
    : `An important update for <strong>${profileName}</strong>.`

  const headingText = isBn
    ? 'উর্বর সময় শুরু হয়েছে'
    : 'Fertile Window Begins'

  const windowLabel = isBn
    ? `${fertileStart} থেকে ${fertileEnd}`
    : `${fertileStart} to ${fertileEnd}`

  const ovulationLabel = isBn
    ? `ডিম্বস্ফোটনের সম্ভাব্য তারিখ: ${ovulationDate}`
    : `Estimated ovulation date: ${ovulationDate}`

  const tipText = isBn
    ? 'এই সময়টি গর্ভধারণের জন্য সবচেয়ে অনুকূল। আপনার স্বাস্থ্য ও ওষুধের ব্যাপারে সচেতন থাকুন।'
    : 'This is your most fertile period in the cycle. Stay mindful of your health and track any symptoms you notice.'

  const tipLabel = isBn ? 'জানুন' : 'Did you know'

  const windowSubLabel = isBn ? 'উর্বর সময়কাল' : 'Fertile window'

  const body = `
    <p style="margin:0 0 4px;color:${P.muted};font-size:16px;font-weight:500;">${greeting}</p>
    <p style="margin:0 0 28px;color:${P.muted};font-size:15px;">${profileLine}</p>

    <!-- Alert card -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${P.bg};border-left:4px solid ${P.goldInk};border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 6px;color:${P.ink};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">
            ${headingText}
          </p>
          <p style="margin:0 0 4px;color:${P.ink};font-size:20px;font-weight:700;">${windowSubLabel}: ${windowLabel}</p>
          <p style="margin:0;color:${P.muted};font-size:14px;">${ovulationLabel}</p>
        </td>
      </tr>
    </table>

    <!-- Tip card -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${P.peach};border-radius:8px;margin-bottom:8px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 6px;color:${P.ink};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">
            ${tipLabel}
          </p>
          <p style="margin:0;color:${P.ink};font-size:14px;line-height:1.6;">${tipText}</p>
        </td>
      </tr>
    </table>
  `

  return { subject, html: wrapLayout(language, body) }
}

// ─── Logging Reminder ─────────────────────────────────────────────────────────

export function loggingReminderEmail(data: LoggingReminderData): EmailResult {
  const { userName, profileName, language, daysSinceLastLog } = data
  const isBn = language === 'BN'

  const subject = isBn
    ? 'সাইকেল সার্কেল: আপনার সাইকেল লগ করতে ভুলবেন না'
    : 'Cycle Circle: Don\'t forget to log your cycle'

  const greeting = isBn
    ? `হ্যালো ${userName},`
    : `Hi ${userName},`

  const profileLine = isBn
    ? `<strong>${profileName}</strong> এর জন্য একটি মনে করিয়ে দেওয়া।`
    : `A gentle reminder for <strong>${profileName}</strong>.`

  const headingText = isBn
    ? 'লগ করা বাকি আছে'
    : 'Cycle Logging Reminder'

  const daysText =
    daysSinceLastLog >= 999
      ? isBn
        ? 'আপনি এখনো কোনো পিরিয়ড লগ করেননি।'
        : "You haven't logged a period yet."
      : isBn
        ? `শেষ লগের পর ${daysSinceLastLog} দিন হয়ে গেছে।`
        : `It's been ${daysSinceLastLog} day${daysSinceLastLog !== 1 ? 's' : ''} since your last log.`

  const ctaText = isBn
    ? 'নিয়মিত লগ করা আপনার পূর্বাভাসকে আরও সঠিক করে তোলে।'
    : 'Logging regularly makes your predictions more accurate over time.'

  const tipText = isBn
    ? 'অ্যাপটি খুলুন এবং আজকের তারিখের তথ্য লগ করুন — এটি মাত্র কয়েক সেকেন্ডের কাজ!'
    : 'Open the app and log today\'s data — it only takes a few seconds!'

  const tipLabel = isBn ? 'কীভাবে করবেন' : 'Quick tip'

  const body = `
    <p style="margin:0 0 4px;color:${P.muted};font-size:16px;font-weight:500;">${greeting}</p>
    <p style="margin:0 0 28px;color:${P.muted};font-size:15px;">${profileLine}</p>

    <!-- Alert card -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${P.bg};border-left:4px solid ${P.cta};border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 6px;color:${P.cta};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">
            ${headingText}
          </p>
          <p style="margin:0 0 6px;color:${P.ink};font-size:18px;font-weight:600;">${daysText}</p>
          <p style="margin:0;color:${P.muted};font-size:14px;">${ctaText}</p>
        </td>
      </tr>
    </table>

    <!-- Tip card -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${P.peach};border-radius:8px;margin-bottom:8px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 6px;color:${P.ink};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">
            ${tipLabel}
          </p>
          <p style="margin:0;color:${P.ink};font-size:14px;line-height:1.6;">${tipText}</p>
        </td>
      </tr>
    </table>
  `

  return { subject, html: wrapLayout(language, body) }
}

// ─── Profile Completion Reminder ──────────────────────────────────────────────

export function profileCompletionReminderEmail(data: ProfileCompletionReminderData): EmailResult {
  const { userName, language } = data
  const isBn = language === 'BN'

  const subject = isBn
    ? 'সাইকেল সার্কেল: আপনার প্রোফাইল সেটআপ শেষ করুন'
    : 'Cycle Circle: Finish setting up your profile'

  const greeting = isBn
    ? `হ্যালো ${userName},`
    : `Hi ${userName},`

  const headingText = isBn
    ? 'প্রোফাইল সেটআপ বাকি আছে'
    : 'Your profile is almost ready'

  const mainText = isBn
    ? 'আপনি সাইকেল সার্কেলে যোগ দিয়েছেন — অসাধারণ! আপনার প্রোফাইল সম্পূর্ণ করলে আমরা আপনাকে আরও সঠিক সাইকেল পূর্বাভাস এবং ব্যক্তিগতকৃত স্বাস্থ্য তথ্য দিতে পারব।'
    : 'You\'ve joined Cycle Circle — that\'s a great first step! Completing your profile helps us give you more accurate cycle predictions and personalised health insights.'

  const ctaText = isBn
    ? 'প্রোফাইল সম্পূর্ণ করুন'
    : 'Complete your profile'

  const tipText = isBn
    ? 'মাত্র কয়েকটি তথ্য যোগ করলেই আপনি পূর্ণ সুবিধা পাবেন — এটি ২ মিনিটেরও কম সময়ে করা যায়।'
    : 'Adding just a few details unlocks the full experience — it takes less than 2 minutes.'

  const tipLabel = isBn ? 'একটু সময় নিন' : 'Quick to finish'

  const body = `
    <p style="margin:0 0 4px;color:${P.muted};font-size:16px;font-weight:500;">${greeting}</p>
    <p style="margin:0 0 28px;color:${P.muted};font-size:15px;">&nbsp;</p>

    <!-- Main card -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${P.bg};border-left:4px solid ${P.cta};border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 6px;color:${P.cta};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">
            ${headingText}
          </p>
          <p style="margin:0 0 20px;color:${P.ink};font-size:15px;line-height:1.6;">${mainText}</p>
          <a href="${appBaseUrl()}/profiles"
            style="display:inline-block;background:${P.cta};color:${P.onCta};text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:999px;">
            ${ctaText}
          </a>
        </td>
      </tr>
    </table>

    <!-- Tip card -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${P.peach};border-radius:8px;margin-bottom:8px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 6px;color:${P.ink};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">
            ${tipLabel}
          </p>
          <p style="margin:0;color:${P.ink};font-size:14px;line-height:1.6;">${tipText}</p>
        </td>
      </tr>
    </table>
  `

  return { subject, html: wrapLayout(language, body) }
}
