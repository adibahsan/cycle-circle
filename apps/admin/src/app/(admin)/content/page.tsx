import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getArticles,
  getCategories,
  getContentStatusBreakdownQuery,
  getContentByCategoryQuery,
  getContentByPhaseQuery,
} from '@/app/queries/content-queries'
import { parseArticleListParams } from '@vesta/shared/utils/article-list-params'
import { ContentClient } from './ContentClient'

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminUser()
  const params = await searchParams

  const [data, categories, statusBreakdown, byCategory, byPhase] = await Promise.all([
    getArticles(parseArticleListParams(params)),
    getCategories(),
    getContentStatusBreakdownQuery(),
    getContentByCategoryQuery(),
    getContentByPhaseQuery(),
  ])

  return (
    <ContentClient
      data={data}
      categories={categories}
      statusBreakdown={statusBreakdown}
      byCategory={byCategory}
      byPhase={byPhase}
    />
  )
}
