import { notFound } from 'next/navigation'
import { requireAdminUser } from '@/app/queries/auth-queries'
import { getArticle, getCategories } from '@/app/queries/content-queries'
import { EditArticleClient } from './EditArticleClient'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'

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
      <AdminPageHeader
        title="Edit Article"
        description={article.titleEn}
        tags={[adminCacheTags.article(id), adminCacheTags.content]}
      />
      <EditArticleClient
        article={article}
        scheduled={article.status === 'PUBLISHED' && !!article.publishedAt && new Date(article.publishedAt) > new Date()}
        categories={categories}
      />
    </div>
  )
}
