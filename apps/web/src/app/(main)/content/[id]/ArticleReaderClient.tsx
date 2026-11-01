'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Info } from 'lucide-react'
import '@vesta/shared/utils/i18n'
import { useLanguage } from '@/lib/use-language'
import { getPhaseColor, parseCyclePhase } from '@vesta/shared/utils/cycle-utils'
import type { ReaderArticle } from '@/app/queries/content-queries'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import type { Article } from '../ContentClient'

function phaseColorFor(name: string): string {
  const phase = parseCyclePhase(name)
  return phase ? getPhaseColor(phase) : 'var(--goal-accent)'
}

interface ArticleReaderClientProps {
  /** Bodies are already sanitised on the server. */
  article: ReaderArticle
  moreArticles: Article[]
}

export function ArticleReaderClient({ article, moreArticles }: ArticleReaderClientProps) {
  const { t } = useTranslation()
  const language = useLanguage()

  const title = language === 'bn' && article.titleBn ? article.titleBn : article.titleEn
  // BN reader on an article with no BN body falls back to English, with a note.
  const isBodyFallback = language === 'bn' && !article.bodyBn
  const bodyHtml = language === 'bn' && article.bodyBn ? article.bodyBn : article.bodyEn

  const titleOf = (a: Article) => (language === 'bn' && a.titleBn ? a.titleBn : a.titleEn)
  const excerptOf = (a: Article) => (language === 'bn' && a.excerptBn ? a.excerptBn : a.excerptEn)

  return (
    <PageContainer width="canvas">
      <PageHeader title={title} />
      <Link
        href="/content"
        className="flex w-fit items-center gap-1 text-sm text-[var(--goal-accent)] font-medium mb-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] rounded"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {t('content.backToArticles')}
      </Link>

      {/* From xl the article keeps a reading measure and the spare width holds what to read next. */}
      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <article aria-label={title} className="glass rounded-2xl p-6 sm:p-8">
          {(article.category || article.cyclePhases.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {article.category && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--goal-accent)]/10 text-[var(--color-text-primary)]">
                  {article.category.name}
                </span>
              )}
              {article.cyclePhases.map((phase) => (
                <span
                  key={phase}
                  className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: phaseColorFor(phase), color: `var(--color-on-${phase.toLowerCase()})` }}
                >
                  {t(`dashboard.${phase.toLowerCase()}`)}
                </span>
              ))}
            </div>
          )}

          {isBodyFallback && (
            <div
              role="note"
              className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] text-xs"
            >
              <Info size={13} aria-hidden="true" className="shrink-0" />
              <span>{t('content.showingInEnglish')}</span>
            </div>
          )}

          <div className="article-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </article>

        {moreArticles.length > 0 && (
          <aside aria-labelledby="more-articles-title" className="xl:sticky xl:top-4">
            <SectionHeader as="h2" id="more-articles-title" title={t('content.moreArticles')} />
            <ul className="flex flex-col gap-2">
              {moreArticles.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/content/${a.id}`}
                    className="block rounded-2xl bg-[var(--color-bg-card)] p-4 hover:shadow-soft transition-shadow duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                  >
                    <span className="block text-sm font-bold text-[var(--color-text-primary)] leading-snug">{titleOf(a)}</span>
                    {excerptOf(a) && (
                      <span className="mt-1 block text-xs text-[var(--color-text-muted)] line-clamp-2">{excerptOf(a)}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </PageContainer>
  )
}
