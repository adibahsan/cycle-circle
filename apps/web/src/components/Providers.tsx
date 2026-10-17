'use client'

import { useEffect } from 'react'
import { MotionConfig } from 'motion/react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import i18n from '@vesta/shared/utils/i18n'

export function Providers({ children }: { children: React.ReactNode }) {
  const { theme, language } = useAppStore(useShallow((s) => ({ theme: s.theme, language: s.language })))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = language
    if (i18n.language !== language) {
      i18n.changeLanguage(language)
    }
  }, [language])

  // Honour the OS reduced-motion setting for every motion component (loops, entrances, layout).
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
