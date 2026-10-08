'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import '@vesta/shared/utils/i18n'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { BrandLogo } from '@/components/ui/BrandLogo'

const BTN = 'px-4 py-2 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action)]'

interface ErrorStateProps {
  variant: 'error' | 'notFound'
  reset?: () => void
  /** Wrap in a full-height page (root error / not-found, outside the signed-in shell). */
  standalone?: boolean
}

/** Shared error / not-found body built on PageContainer + PageHeader. */
export function ErrorState({ variant, reset, standalone = false }: ErrorStateProps) {
  const { t } = useTranslation()
  const isError = variant === 'error'

  const body = (
    <PageContainer>
      <BrandLogo size={64} alt="" />
      <PageHeader
        title={isError ? t('common.error') : t('common.notFoundTitle')}
        subtitle={isError ? t('common.errorBody') : t('common.notFoundBody')}
      />
      <div className="flex flex-wrap items-center gap-3">
        {isError ? (
          <>
            <button
              type="button"
              onClick={reset}
              className={`${BTN} border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]`}
            >
              {t('common.tryAgain')}
            </button>
            <Link href="/login" className={`${BTN} bg-[var(--color-action)] text-[var(--color-on-action)] hover:opacity-90`}>
              {t('common.goToLogin')}
            </Link>
          </>
        ) : (
          <Link href="/dashboard" className={`${BTN} bg-[var(--color-action)] text-[var(--color-on-action)] hover:opacity-90`}>
            {t('common.goToDashboard')}
          </Link>
        )}
      </div>
    </PageContainer>
  )

  return standalone ? (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">{body}</main>
  ) : (
    body
  )
}
