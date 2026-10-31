import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../../src')
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8')

const PAGES: Record<string, 'default' | 'canvas'> = {
  'app/(main)/dashboard/DashboardClient.tsx': 'canvas',
  'app/(main)/calendar/CalendarClient.tsx': 'canvas',
  'app/(main)/symptoms/SymptomsClient.tsx': 'canvas',
  'app/(main)/insights/InsightsClient.tsx': 'canvas',
  'app/(main)/content/ContentClient.tsx': 'canvas',
  'app/(main)/content/[id]/ArticleReaderClient.tsx': 'canvas',
  'app/(main)/profiles/ProfilesClient.tsx': 'canvas',
  'app/(main)/settings/SettingsClient.tsx': 'canvas',
  'app/(main)/subscription/SubscriptionClient.tsx': 'canvas',
  'app/(main)/feedback/FeedbackClient.tsx': 'canvas',
}

describe('page shell scale', () => {
  const header = read('components/ui/PageHeader.tsx')
  const container = read('components/ui/PageContainer.tsx')

  it('PageHeader renders the single h1 with the title scale', () => {
    expect(header).toMatch(/<h1[^>]*text-2xl md:text-3xl font-bold/)
  })

  it('PageContainer carries width, padding and gap scale', () => {
    for (const c of ['max-w-4xl', 'max-w-5xl', 'px-4 md:px-8', 'py-4', 'gap-5'])
      expect(container).toContain(c)
  })

  for (const [file, width] of Object.entries(PAGES)) {
    it(`${file} uses the shared header and container`, () => {
      const src = read(file)
      expect(src).toContain('<PageHeader')
      expect(src).toContain('<PageContainer')
      expect(src).not.toMatch(/<h1[\s>]/)
      if (width !== 'default') expect(src).toMatch(new RegExp(`<PageContainer[^>]*width="${width}"`))
    })
  }

  it('signed-in shell has no h1 wordmarks and no own width/padding', () => {
    const layout = read('app/(main)/layout.tsx')
    expect(layout).not.toMatch(/<h1[\s>]/)
    expect(layout).not.toContain('md:max-w-4xl')
  })

  it('error and not-found pages use the shared ErrorState', () => {
    for (const f of ['app/error.tsx', 'app/(main)/error.tsx', 'app/not-found.tsx'])
      expect(read(f)).toContain('ErrorState')
  })
})
