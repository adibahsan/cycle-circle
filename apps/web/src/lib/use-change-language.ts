'use client'

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { saveLanguage } from '@/app/actions/user-actions'
import { useAppStore } from './store'
import type { Lang } from './language'

/**
 * Switches the UI language (cookie, store, i18n) and saves it to the User so reminders
 * and emails follow it (#254). The save is a no-op when logged out and never blocks the switch.
 */
export function useChangeLanguage(): (lang: Lang) => void {
  const setLanguage = useAppStore((s) => s.setLanguage)
  const { i18n } = useTranslation()
  return useCallback(
    (lang: Lang) => {
      setLanguage(lang)
      i18n.changeLanguage(lang)
      saveLanguage(lang).catch(() => {})
    },
    [setLanguage, i18n],
  )
}
