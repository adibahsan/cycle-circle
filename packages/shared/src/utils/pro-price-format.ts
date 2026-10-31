// Pro price text for customers, in English and Bangla (Bangla numerals). Pure: the price comes
// from the Pro price service (ADR 0011); nothing here knows a taka figure.

export interface ProPriceLike {
  /** Taka. */
  amount: number
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY'
}

const UNITS = {
  en: { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month' },
  bn: { DAILY: 'দিন', WEEKLY: 'সপ্তাহ', MONTHLY: 'মাস' },
} as const

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']

const isBangla = (lang: string) => lang === 'bn' || lang.startsWith('bn-')

/** The taka sign and amount, e.g. `৳5` or `৳৭.৫`. */
function formatAmount(amount: number, bn: boolean): string {
  const text = String(amount)
  return `৳${bn ? text.replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : text}`
}

/** Pieces for interpolating into translated text: `{{price}}`, `{{amount}}`, `{{period}}`. */
export function proPriceVars(price: ProPriceLike, lang: string): { price: string; amount: string; period: string } {
  const bn = isBangla(lang)
  const amount = formatAmount(price.amount, bn)
  const period = UNITS[bn ? 'bn' : 'en'][price.period]
  return { price: `${amount}/${period}`, amount, period }
}

/** The whole price, e.g. `৳5/day` or `৳৫/দিন`. */
export function formatProPrice(price: ProPriceLike, lang: string): string {
  return proPriceVars(price, lang).price
}
