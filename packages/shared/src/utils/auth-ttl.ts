// How long login codes and links stay valid. Client-safe: the copy that tells Users these
// times is built from the same constants the server enforces, so they can't drift (#256).

/** Phone login OTP challenge, BDApps OTP and App OTP alike. */
export const OTP_TTL_MS = 5 * 60 * 1000

/** Email magic link. */
export const MAGIC_LINK_TTL_MS = 60 * 60 * 1000

const UNITS = {
  en: { minute: ['minute', 'minutes'], hour: ['hour', 'hours'] },
  bn: { minute: ['মিনিট', 'মিনিট'], hour: ['ঘণ্টা', 'ঘণ্টা'] },
} as const

/** A TTL as words, e.g. `5 minutes`, `1 hour`, `৫ মিনিট`. Whole hours are written as hours. */
export function durationText(ms: number, lang: 'en' | 'bn'): string {
  const minutes = Math.round(ms / 60_000)
  const inHours = minutes >= 60 && minutes % 60 === 0
  const n = inHours ? minutes / 60 : minutes
  const unit = UNITS[lang][inHours ? 'hour' : 'minute'][n === 1 ? 0 : 1]
  const num = new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en', { useGrouping: false }).format(n)
  return `${num} ${unit}`
}
