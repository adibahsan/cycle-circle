import { requireAdminUser } from '@/app/queries/auth-queries'
import { getCategories } from '@/app/queries/content-queries'
import { ArticleEditorClient } from './ArticleEditorClient'

export const dynamic = 'force-dynamic'

export default async function NewArticlePage() {
  await requireAdminUser()
  const categories = await getCategories()

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">New Article</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Create a new health article in English and Bengali.
        </p>
      </div>
      <ArticleEditorClient categories={categories} />
    </div>
  )
}
