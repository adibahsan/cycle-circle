'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { revalidateAdminTags } from '@/app/actions/cache-actions'
import { Button } from '@/components/ui/Button'

interface RefetchButtonProps {
  tags: string[]
  label?: string
}

export function RefetchButton({ tags, label = 'Refresh' }: RefetchButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleRefresh() {
    startTransition(async () => {
      if (tags.length > 0) {
        await revalidateAdminTags(tags)
      }
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={isPending}
      onClick={handleRefresh}
      aria-label="Refresh data"
    >
      <RefreshCw size={14} aria-hidden="true" />
      {label}
    </Button>
  )
}
