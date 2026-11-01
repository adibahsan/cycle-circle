import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createArticle,
  updateArticle,
  listArticles,
  getContentStatusBreakdown,
  listPublishedArticles,
  listPublishedCategories,
  getPublishedArticleById,
  ContentError,
} from '@vesta/shared/server/services'
import { dhakaDateTimeToInstant, instantToDhakaInput } from '@vesta/shared/utils/dhaka-date'

const prisma = new PrismaClient()
const ADMIN_ID = 'test-artsched-admin'
const P = `Sc${Date.now().toString(36)}`
let seq = 0
const created: string[] = []
const categories: string[] = []

// 2026-11-02 00:00 in Bangladesh is 2026-11-01 18:00 UTC.
const BD_MIDNIGHT = dhakaDateTimeToInstant('2026-11-02T00:00')!
const ms = (d: Date, delta: number) => new Date(d.getTime() + delta)

async function make(data: Partial<Parameters<typeof createArticle>[1]> = {}, now = new Date('2026-11-01T10:00:00Z')) {
  const a = await createArticle(ADMIN_ID, {
    titleEn: `${P} article ${++seq}`,
    bodyEn: '<p>en</p>',
    cyclePhases: ['LUTEAL'],
    status: 'PUBLISHED',
    ...data,
  }, now)
  created.push(a.id)
  return a
}

beforeAll(async () => {
  await prisma.user.create({
    data: { id: ADMIN_ID, phone: '+8801700099215', fullName: 'Sched Admin', authMethod: 'OTP', profileCompleted: true },
  })
})

afterAll(async () => {
  await prisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN_ID } })
  await prisma.article.deleteMany({ where: { id: { in: created } } })
  await prisma.articleCategory.deleteMany({ where: { id: { in: categories } } })
  await prisma.user.delete({ where: { id: ADMIN_ID } })
  await prisma.$disconnect()
})

describe('Bangladesh date-time input', () => {
  it('reads a wall time as Bangladesh time', () => {
    expect(BD_MIDNIGHT.toISOString()).toBe('2026-11-01T18:00:00.000Z')
    expect(dhakaDateTimeToInstant('2026-11-01 05:59')!.toISOString()).toBe('2026-10-31T23:59:00.000Z')
  })
  it('rejects malformed and non-existent times', () => {
    for (const bad of ['', 'x', '2026-02-31T10:00', '2026-11-01T24:00', '2026-11-01T10:60', '2026-11-01']) {
      expect(dhakaDateTimeToInstant(bad)).toBeUndefined()
    }
  })
  it('round-trips an instant back to the Bangladesh wall time', () => {
    expect(instantToDhakaInput(BD_MIDNIGHT)).toBe('2026-11-02T00:00')
    expect(instantToDhakaInput('2026-11-01T17:59:00Z')).toBe('2026-11-01T23:59')
  })
})

describe('visibility rule on customer reads', () => {
  it('hides a scheduled article until its Bangladesh-time moment, from the list and by id', async () => {
    const a = await make({ titleEn: `${P} vis`, publishedAt: BD_MIDNIGHT })
    const listed = async (now: Date) =>
      (await listPublishedArticles({ pageSize: 100 }, now)).articles.some((x) => x.id === a.id)

    const before = ms(BD_MIDNIGHT, -1000) // 17:59:59Z
    expect(await listed(before)).toBe(false)
    expect(await getPublishedArticleById(a.id, before)).toBeNull()

    expect(await listed(BD_MIDNIGHT)).toBe(true) // at the moment: visible
    expect((await getPublishedArticleById(a.id, BD_MIDNIGHT))?.id).toBe(a.id)

    expect(await listed(ms(BD_MIDNIGHT, 60_000))).toBe(true)
  })

  it('category chips ignore categories whose only article is still scheduled', async () => {
    const cat = await prisma.articleCategory.create({ data: { name: `${P} cat`, slug: `${P}-cat` } })
    categories.push(cat.id)
    await make({ titleEn: `${P} chip`, categoryId: cat.id, publishedAt: BD_MIDNIGHT })
    const has = async (now: Date) => (await listPublishedCategories(now)).some((c) => c.id === cat.id)
    expect(await has(ms(BD_MIDNIGHT, -1))).toBe(false)
    expect(await has(BD_MIDNIGHT)).toBe(true)
  })
})

describe('scheduling rules', () => {
  it('publishes immediately without a date, and treats a past date as now', async () => {
    const now = new Date('2026-11-01T10:00:00Z')
    expect((await make({}, now)).publishedAt).toEqual(now)
    expect((await make({ publishedAt: ms(now, -86_400_000) }, now)).publishedAt).toEqual(now)
  })

  it('rejects an invalid date, or a date on a non-published article', async () => {
    await expect(make({ publishedAt: new Date('nope') })).rejects.toBeInstanceOf(ContentError)
    await expect(make({ status: 'DRAFT', publishedAt: BD_MIDNIGHT })).rejects.toBeInstanceOf(ContentError)
  })

  it('changes a schedule, publishes now, or cancels to draft before it goes live', async () => {
    const now = new Date('2026-11-01T10:00:00Z')
    const a = await make({ publishedAt: BD_MIDNIGHT }, now)
    const later = ms(BD_MIDNIGHT, 3_600_000)
    expect((await updateArticle(a.id, { status: 'PUBLISHED', publishedAt: later }, now)).publishedAt).toEqual(later)
    // Saving again without a date keeps the schedule.
    expect((await updateArticle(a.id, { status: 'PUBLISHED', titleEn: `${P} kept` }, now)).publishedAt).toEqual(later)
    // null = publish now.
    expect((await updateArticle(a.id, { status: 'PUBLISHED', publishedAt: null }, now)).publishedAt).toEqual(now)

    const b = await make({ publishedAt: BD_MIDNIGHT }, now)
    const cancelled = await updateArticle(b.id, { status: 'DRAFT' }, now)
    expect(cancelled.status).toBe('DRAFT')
    expect(cancelled.publishedAt).toBeNull()
  })

  it('does not move the date of an article that is already live', async () => {
    const now = new Date('2026-11-01T10:00:00Z')
    const a = await make({}, ms(now, -3_600_000))
    await expect(
      updateArticle(a.id, { status: 'PUBLISHED', publishedAt: ms(now, 86_400_000) }, now),
    ).rejects.toBeInstanceOf(ContentError)
  })
})

describe('admin list scheduled/published filters', () => {
  it('splits PUBLISHED articles by whether their time has come', async () => {
    const live = await make({ titleEn: `${P} live` }, ms(BD_MIDNIGHT, -86_400_000))
    const sched = await make({ titleEn: `${P} soon`, publishedAt: BD_MIDNIGHT })
    const ids = async (status: 'scheduled' | 'PUBLISHED', now: Date) =>
      (await listArticles({ q: P, status, pageSize: 100 }, now)).articles.map((x) => x.id)

    const before = ms(BD_MIDNIGHT, -1000)
    expect(await ids('scheduled', before)).toContain(sched.id)
    expect(await ids('scheduled', before)).not.toContain(live.id)
    expect(await ids('PUBLISHED', before)).toContain(live.id)
    expect(await ids('PUBLISHED', before)).not.toContain(sched.id)

    expect(await ids('PUBLISHED', BD_MIDNIGHT)).toContain(sched.id)
    expect(await ids('scheduled', BD_MIDNIGHT)).not.toContain(sched.id)
  })

  it('derives the display status from the same now: scheduled flips to published at its time', async () => {
    const live = await make({ titleEn: `${P} ds-live` }, ms(BD_MIDNIGHT, -86_400_000))
    const sched = await make({ titleEn: `${P} ds-soon`, publishedAt: BD_MIDNIGHT })
    const draft = await make({ titleEn: `${P} ds-draft`, status: 'DRAFT' })
    const arch = await make({ titleEn: `${P} ds-arch`, status: 'ARCHIVED' })
    const status = async (now: Date) =>
      Object.fromEntries((await listArticles({ q: `${P} ds-`, pageSize: 100 }, now)).articles.map((x) => [x.id, x.displayStatus]))
    expect(await status(ms(BD_MIDNIGHT, -1000))).toMatchObject({
      [live.id]: 'published', [sched.id]: 'scheduled', [draft.id]: 'draft', [arch.id]: 'archived',
    })
    expect((await status(BD_MIDNIGHT))[sched.id]).toBe('published')
  })
})

describe('status breakdown', () => {
  it('counts a scheduled article as Scheduled, not Published, until its time', async () => {
    await make({ titleEn: `${P} bd-soon`, publishedAt: BD_MIDNIGHT })
    const count = (rows: { status: string; count: number }[], s: string) => rows.find((r) => r.status === s)?.count ?? 0
    const before = await getContentStatusBreakdown(ms(BD_MIDNIGHT, -1000))
    const after = await getContentStatusBreakdown(BD_MIDNIGHT)
    expect(count(before, 'SCHEDULED')).toBeGreaterThanOrEqual(1)
    expect(count(after, 'PUBLISHED')).toBeGreaterThan(count(before, 'PUBLISHED'))
    expect(count(after, 'SCHEDULED')).toBeLessThan(count(before, 'SCHEDULED'))
  })
})
