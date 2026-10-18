import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer'

const CARD = 'flex-1 rounded-panel border border-transparent shadow-panel bg-[var(--color-bg-card)] p-4'

function Section({ title, className, children }: { title: string; className: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-3">
        <Shimmer className="h-8 w-8 rounded-full" />
        <Shimmer className={`h-4 rounded-md ${title}`} />
      </div>
      <div className={CARD}>{children}</div>
    </div>
  )
}

function Row({ withSub = true }: { withSub?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="space-y-1.5">
        <Shimmer className="h-4 w-28 rounded-md" />
        {withSub && <Shimmer className="h-3 w-40 rounded-md" />}
      </div>
      <Shimmer className="h-8 w-14 shrink-0 rounded-full" />
    </div>
  )
}

/**
 * Skeleton in the settings page's shape: title, then the same grid as SettingsClient
 * (appearance + notifications | account | export + about from xl).
 */
export default function SettingsLoading() {
  return (
    <PageContainer width="canvas">
      <Shimmer className="h-8 w-32 rounded-lg md:h-9" />

      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:grid-cols-3 xl:grid-rows-[auto_1fr] xl:items-stretch">
        <div className="space-y-3 lg:space-y-4 xl:col-start-1 xl:row-span-2 xl:row-start-1 xl:flex xl:flex-col">
          <Section title="w-44" className="h-[199px] lg:h-[207px]">
            <Row />
            <div className="my-2 h-px bg-[var(--color-border)]" />
            <Row />
          </Section>
          <Section title="w-28" className="h-[307px] lg:h-[315px] 2xl:h-[301px]">
            <Row />
            <Row />
            <Row />
            <Row />
          </Section>
        </div>

        <div className="space-y-3 lg:space-y-4 xl:contents">
          <Section title="w-28" className="h-[228px] xl:col-start-3 xl:row-start-1 xl:h-[236px] 2xl:h-[220px]">
            <Shimmer className="h-4 w-full rounded-md" />
            <Shimmer className="mt-4 h-4 w-40 rounded-md" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="h-[70px] rounded-panel bg-tint-sky" />
              <div className="h-[70px] rounded-panel bg-tint-mint" />
            </div>
          </Section>
          <Section title="w-24" className="h-[430px] xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:h-auto">
            <div className="h-[120px] rounded-panel bg-tint-pink" />
            <div className="mt-3 space-y-2">
              <Shimmer className="h-9 w-full rounded-xl" />
              <Shimmer className="h-9 w-full rounded-xl" />
              <Shimmer className="h-9 w-full rounded-xl" />
              <Shimmer className="h-9 w-full rounded-xl" />
            </div>
          </Section>
          <Section title="w-20" className="h-[185px] xl:col-start-3 xl:row-start-2 xl:h-auto">
            <Shimmer className="h-5 w-full rounded-md" />
            <div className="mt-3 h-14 rounded-2xl bg-tint-sage" />
          </Section>
        </div>
      </div>
    </PageContainer>
  )
}
