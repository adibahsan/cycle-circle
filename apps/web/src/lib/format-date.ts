const cache = new Map<string, Intl.DateTimeFormat>()

/** "Oct 8" / "৮ অক্টোবর": short month + day in the user's language (Bengali uses bn-BD, otherwise the browser locale). */
export function formatShortDate(language: string, date: Date): string {
  const locale = language === 'bn' ? 'bn-BD' : 'default'
  let fmt = cache.get(locale)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale === 'default' ? undefined : locale, { month: 'short', day: 'numeric' })
    cache.set(locale, fmt)
  }
  return fmt.format(date)
}
