'use client'

import { useEffect, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { I18nextProvider } from 'react-i18next'
import { useAppStore } from '@/lib/store'
import { useLanguage } from '@/lib/use-language'
import type { Lang } from '@/lib/language'
import i18n from '@vesta/shared/utils/i18n'

/**
 * On the server, each request gets its own i18n clone in `initialLanguage` (the singleton is
 * shared across requests). On the client, the singleton and the store are switched to
 * `initialLanguage` before the first render, so hydration sees what the server rendered.
 */
function useRequestI18n(initialLanguage: Lang) {
  const [instance] = useState(() => {
    if (typeof window === 'undefined') return i18n.cloneInstance({ lng: initialLanguage })
    if (i18n.language !== initialLanguage) i18n.changeLanguage(initialLanguage)
    if (useAppStore.getState().language !== initialLanguage) useAppStore.setState({ language: initialLanguage })
    return i18n
  })
  return instance
}

function DocumentSync() {
  const theme = useAppStore((s) => s.theme)
  const language = useLanguage()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return null
}

export function Providers({ initialLanguage, children }: { initialLanguage: Lang; children: React.ReactNode }) {
  const instance = useRequestI18n(initialLanguage)
  return (
    <I18nextProvider i18n={instance}>
      <DocumentSync />
      {/* Honour the OS reduced-motion setting for every motion component (loops, entrances, layout). */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </I18nextProvider>
  )
}
