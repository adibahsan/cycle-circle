'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import i18n from '@vesta/shared/utils/i18n'

export function Providers({ children }: { children: React.ReactNode }) {
  const { theme, language } = useAppStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = language
    if (i18n.language !== language) {
      i18n.changeLanguage(language)
    }
  }, [language])

  return <>{children}</>
}
