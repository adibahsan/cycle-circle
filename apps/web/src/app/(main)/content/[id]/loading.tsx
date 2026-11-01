import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer'

/** Skeleton in the reader's shape: title, back link, then the article card with chips and paragraphs. */
export default function ArticleLoading() {
  return (
    <PageContainer width="canvas">
      <Shimmer className="h-8 w-80 max-w-full rounded-lg md:h-9" />
      <Shimmer className="mb-4 h-4 w-32 rounded-md" />
      <div className="rounded-2xl bg-[var(--color-bg-card)] p-6 shadow-soft sm:p-8 xl:mr-[21.25rem] 2xl:mr-[25.25rem]">
        <div className="mb-5 flex gap-1.5">
          <Shimmer className="h-5 w-20 rounded-full" />
          <Shimmer className="h-5 w-20 rounded-full" />
        </div>
        <div className="max-w-[70ch] space-y-3">
          <Shimmer className="h-6 w-1/2 rounded-md" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Shimmer key={i} className="h-4 w-full rounded-md" />
          ))}
          <Shimmer className="h-4 w-2/3 rounded-md" />
        </div>
      </div>
    </PageContainer>
  )
}
