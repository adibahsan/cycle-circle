import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getArticles,
  getCategories,
  getContentStatusBreakdownQuery,
  getContentByCategoryQuery,
  getContentByPhaseQuery,
} from '@/app/queries/content-queries'
import { ContentClient } from './ContentClient'

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  await requireAdminUser()
  const params = await searchParams

  const [data, categories, statusBreakdown, byCategory, byPhase] = await Promise.all([
    getArticles({
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 20,
      status: params.status,
      categoryId: params.categoryId,
    }),
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
