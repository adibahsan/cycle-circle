import { notFound } from 'next/navigation'
import { requireAdminUser } from '@/app/queries/auth-queries'
import { getArticle, getCategories } from '@/app/queries/content-queries'
import { EditArticleClient } from './EditArticleClient'

export const dynamic = 'force-dynamic'

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminUser()
  const { id } = await params

  const [article, categories] = await Promise.all([
    getArticle(id),
    getCategories(),
  ])

  if (!article) notFound()

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Edit Article</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)] truncate max-w-lg">
          {article.titleEn}
        </p>
      </div>
      <EditArticleClient article={article} categories={categories} />
    </div>
  )
}
