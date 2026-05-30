import { requireAdminUser } from '@/app/queries/auth-queries'
import { getCategories } from '@/app/queries/content-queries'
import { ArticleEditorClient } from './ArticleEditorClient'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'

export default async function NewArticlePage() {
  await requireAdminUser()
  const categories = await getCategories()

  return (
    <div className="space-y-6 page-enter">
      <AdminPageHeader
        title="New Article"
        description="Create a new health article in English and Bengali."
        tags={[adminCacheTags.content]}
      />
      <ArticleEditorClient categories={categories} />
    </div>
  )
}
