'use client'

import { useEffect } from 'react'
import { useAdminStore } from '@/lib/store'

export function Providers({ children }: { children: React.ReactNode }) {
  const { theme } = useAdminStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
  }, [theme])

  return <>{children}</>
}
