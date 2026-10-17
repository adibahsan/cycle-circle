'use client'

import { useTranslation } from 'react-i18next'
import { parseLang, type Lang } from './language'

/** Current language from the i18n instance in context: identical on the server and the hydrating client. */
export function useLanguage(): Lang {
  return parseLang(useTranslation().i18n.language)
}
