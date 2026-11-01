import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { after } from 'next/server'
import { recordArticleView } from '@vesta/shared/server/services'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getPublishedArticle, getPublishedArticles } from '@/app/queries/content-queries'
import { ArticleReaderClient } from './ArticleReaderClient'

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return {}
  const article = await getPublishedArticle(id)
  return article ? { title: article.titleEn } : {}
}

/** The Learn reader: one published article per URL, `/content/<article id>`. */
export default async function ArticlePage({ params }: Params) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { id } = await params
  const [article, { articles }] = await Promise.all([getPublishedArticle(id), getPublishedArticles()])
  if (!article) notFound()

  // One view per user per Bangladesh day, only for an article the reader shows. Runs on every
  // request (never inside a cached loader), after the response; a failure must not break reading.
  const now = new Date()
  after(() =>
    recordArticleView(article.id, user.id, now).catch((err) => console.error('[article-view] record failed', err)),
  )

  // "More to read": articles sharing a phase with this one first, then the rest.
  const others = articles.filter((a) => a.id !== article.id)
  const phases: string[] = article.cyclePhases
  const sharesPhase = (list: string[]) => list.some((p) => phases.includes(p))
  const moreArticles = [...others.filter((a) => sharesPhase(a.cyclePhases)), ...others.filter((a) => !sharesPhase(a.cyclePhases))].slice(0, 5)

  return <ArticleReaderClient article={article} moreArticles={moreArticles} />
}
