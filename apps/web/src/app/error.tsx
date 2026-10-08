'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/ErrorState'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return <ErrorState variant="error" reset={reset} standalone />
}
