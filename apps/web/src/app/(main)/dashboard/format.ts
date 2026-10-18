import { appLocale } from '@/lib/language'

const cache = new Map<string, Intl.NumberFormat>()

/** A whole number in the app language: Bengali digits for `bn`. */
export function formatCount(language: string, n: number): string {
  const locale = appLocale(language)
  let fmt = cache.get(locale)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
    cache.set(locale, fmt)
  }
  return fmt.format(n)
}
