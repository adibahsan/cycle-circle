import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createArticle, listArticles, recordArticleView } from '@vesta/shared/server/services'
import { parseArticleListParams } from '@vesta/shared/utils/article-list-params'

const prisma = new PrismaClient()
const ADMIN_ID = 'test-artviews-admin'
const U1 = 'test-artviews-u1'
const U2 = 'test-artviews-u2'
const SUSPENDED = 'test-artviews-susp'
const P = `Vw${Date.now().toString(36)}`
const created: string[] = []
// Fixed and in the past, never the real clock: the views below happen at fixed 2026 instants, and a view
// only counts once the article is live, so publishing "now" broke every test once the clock passed them.
const PUBLISHED_AT = new Date('2026-01-01T00:00:00Z')

async function publish(suffix: string, status: 'PUBLISHED' | 'DRAFT' = 'PUBLISHED') {
  const a = await createArticle(
    ADMIN_ID,
    { titleEn: `${P} ${suffix}`, bodyEn: '<p>en</p>', titleBn: 'শিরোনাম', bodyBn: '<p>বাংলা</p>', cyclePhases: ['LUTEAL'], status },
    PUBLISHED_AT,
  )
  created.push(a.id)
  return a
}

const rows = (articleId: string) => prisma.articleView.findMany({ where: { articleId }, orderBy: { day: 'asc' } })
const iso = (d: Date) => d.toISOString().slice(0, 10)

beforeAll(async () => {
  const base = { authMethod: 'OTP' as const, profileCompleted: true }
  await prisma.user.createMany({
    data: [
      { id: ADMIN_ID, phone: '+8801700099081', fullName: 'Views Admin', ...base },
      { id: U1, phone: '+8801700099082', fullName: 'Views U1', ...base },
      { id: U2, phone: '+8801700099083', fullName: 'Views U2', ...base },
      { id: SUSPENDED, phone: '+8801700099084', fullName: 'Views Susp', suspendedAt: new Date(), ...base },
    ],
  })
})

afterAll(async () => {
  await prisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN_ID } })
  await prisma.article.deleteMany({ where: { id: { in: created } } }) // cascades views
  await prisma.user.deleteMany({ where: { id: { in: [ADMIN_ID, U1, U2, SUSPENDED] } } })
  await prisma.$disconnect()
})

describe('recordArticleView', () => {
  it('is idempotent: same user, article and Bangladesh day is one row, no throw', async () => {
    const a = await publish('idem')
    await recordArticleView(a.id, U1, new Date('2026-11-01T03:00:00Z'))
    await recordArticleView(a.id, U1, new Date('2026-11-01T10:00:00Z'))
    await expect(recordArticleView(a.id, U1, new Date('2026-11-01T11:00:00Z'))).resolves.toBeUndefined()
    expect(await rows(a.id)).toHaveLength(1)
  })

  it('counts a new Bangladesh day and a different user separately', async () => {
    const a = await publish('sep')
    await recordArticleView(a.id, U1, new Date('2026-11-01T03:00:00Z'))
    await recordArticleView(a.id, U1, new Date('2026-11-02T03:00:00Z'))
    await recordArticleView(a.id, U2, new Date('2026-11-01T03:00:00Z'))
    expect(await rows(a.id)).toHaveLength(3)
  })

  it('splits days at 18:00 UTC (00:00 Bangladesh)', async () => {
    const a = await publish('boundary')
    await recordArticleView(a.id, U1, new Date('2026-11-01T17:59:00Z'))
    await recordArticleView(a.id, U1, new Date('2026-11-01T18:00:00Z'))
    expect((await rows(a.id)).map((r) => iso(r.day))).toEqual(['2026-11-01', '2026-11-02'])
  })

  it('records nothing for a scheduled article before its time, then counts it', async () => {
    const at = new Date('2026-11-05T10:00:00Z')
    const a = await createArticle(
      ADMIN_ID,
      { titleEn: `${P} sched`, bodyEn: '<p>en</p>', status: 'PUBLISHED', publishedAt: at },
      new Date('2026-11-01T10:00:00Z'),
    )
    created.push(a.id)
    await recordArticleView(a.id, U1, new Date('2026-11-04T10:00:00Z'))
    expect(await rows(a.id)).toHaveLength(0)
    await recordArticleView(a.id, U1, at)
    expect(await rows(a.id)).toHaveLength(1)
  })

  it('ignores drafts, unknown articles and suspended users', async () => {
    const draft = await publish('draft', 'DRAFT')
    const ok = await publish('susp')
    const now = new Date('2026-11-01T03:00:00Z')
    await recordArticleView(draft.id, U1, now)
    await recordArticleView(ok.id, SUSPENDED, now)
    await expect(recordArticleView('no-such-article', U1, now)).resolves.toBeUndefined()
    expect(await rows(draft.id)).toHaveLength(0)
    expect(await rows(ok.id)).toHaveLength(0)
  })
})

describe('listArticles views', () => {
  it('counts views in the Bangladesh-day range (inclusive) and sorts by them', async () => {
    const low = await publish('rng-low')
    const high = await publish('rng-high')
    const mid = await publish('rng-mid')
    // high: 2 in range + 1 before; low: 1 in range; mid: 0 in range, 1 after
    await recordArticleView(high.id, U1, new Date('2026-12-10T03:00:00Z'))
    await recordArticleView(high.id, U2, new Date('2026-12-12T17:59:00Z')) // BD 12-12 (last day, inclusive)
    await recordArticleView(high.id, U1, new Date('2026-12-09T17:59:00Z')) // BD 12-09, before range
    await recordArticleView(low.id, U1, new Date('2026-12-11T03:00:00Z'))
    await recordArticleView(mid.id, U1, new Date('2026-12-12T18:00:00Z')) // BD 12-13, after range

    const r = await listArticles({ q: P, sort: 'views', viewsFrom: '2026-12-10', viewsTo: '2026-12-12' }, new Date())
    const mine = r.articles.filter((a) => [low.id, high.id, mid.id].includes(a.id))
    expect(mine.map((a) => [a.id, a.views])).toEqual([[high.id, 2], [low.id, 1], [mid.id, 0]])

    const all = await listArticles({ q: P, sort: 'views' }, new Date()) // all time
    expect(Object.fromEntries(all.articles.map((a) => [a.id, a.views]))[high.id]).toBe(3)
  })

  it('pages correctly when sorted by views', async () => {
    const r1 = await listArticles({ q: `${P} rng`, sort: 'views', pageSize: 2, page: 1 }, new Date())
    const r2 = await listArticles({ q: `${P} rng`, sort: 'views', pageSize: 2, page: 2 }, new Date())
    expect(r1.articles).toHaveLength(2)
    expect(r2.articles).toHaveLength(1)
    expect(r1.total).toBe(3)
  })

  it('sorts least-read first with sortDir asc, and parses the direction', async () => {
    const r = await listArticles({ q: `${P} rng`, sort: 'views', sortDir: 'asc', viewsFrom: '2026-12-10', viewsTo: '2026-12-12' }, new Date())
    expect(r.articles.map((a) => a.views)).toEqual([0, 1, 2])
    expect(parseArticleListParams({ sort: 'views', sortDir: 'asc' })).toMatchObject({ sort: 'views', sortDir: 'asc' })
    expect(parseArticleListParams({ sort: 'views', sortDir: 'sideways' }).sortDir).toBeUndefined()
  })

  it('parses and validates the views range', () => {
    expect(parseArticleListParams({ sort: 'views', viewsFrom: '2026-12-10', viewsTo: '2026-12-12' })).toMatchObject({
      sort: 'views', viewsFrom: '2026-12-10', viewsTo: '2026-12-12',
    })
    const junk = parseArticleListParams({ viewsFrom: 'nope', viewsTo: '2026-02-31' })
    expect(junk.viewsFrom).toBeUndefined()
    expect(junk.viewsTo).toBeUndefined()
  })
})
