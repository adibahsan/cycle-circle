import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createArticle,
  updateArticle,
  listArticles as listArticlesAt,
  ContentError,
  contentErrorMessage,
} from '@vesta/shared/server/services'
import { parseArticleListParams } from '@vesta/shared/utils/article-list-params'

const prisma = new PrismaClient()
const listArticles = (o?: Parameters<typeof listArticlesAt>[0]) => listArticlesAt(o, new Date())
const ADMIN_ID = 'test-artlist-admin'
// Other test files write articles in parallel: every assertion is scoped to this run's prefix.
const P = `Zq${Date.now().toString(36)}`
const created: string[] = []
const categories: string[] = []

async function make(data: Partial<Parameters<typeof createArticle>[1]> = {}) {
  const a = await createArticle(ADMIN_ID, {
    titleEn: `${P} article`,
    bodyEn: '<p>en</p>',
    titleBn: 'শিরোনাম',
    bodyBn: '<p>বাংলা</p>',
    cyclePhases: ['LUTEAL'],
    ...data,
  }, new Date())
  created.push(a.id)
  return a
}

const titles = (r: { articles: { titleEn: string }[] }) => r.articles.map((a) => a.titleEn).sort()

beforeAll(async () => {
  await prisma.user.create({
    data: { id: ADMIN_ID, phone: '+8801700099071', fullName: 'List Admin', authMethod: 'OTP', profileCompleted: true },
  })
})

afterAll(async () => {
  await prisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN_ID } })
  await prisma.article.deleteMany({ where: { id: { in: created } } })
  await prisma.articleCategory.deleteMany({ where: { id: { in: categories } } })
  await prisma.user.delete({ where: { id: ADMIN_ID } })
  await prisma.$disconnect()
})

describe('listArticles search', () => {
  it('finds an article by English title, case-insensitively, across all pages', async () => {
    for (let i = 0; i < 3; i++) await make({ titleEn: `${P} filler ${i}` })
    await make({ titleEn: `${P} Needle in haystack` })
    const r = await listArticles({ q: `${P.toLowerCase()} needle`, pageSize: 2 })
    expect(titles(r)).toEqual([`${P} Needle in haystack`])
    expect(r.total).toBe(1)
  })

  it('finds an article by Bangla title', async () => {
    await make({ titleEn: `${P} bn-search`, titleBn: `${P} মাসিকের যত্ন` })
    const r = await listArticles({ q: 'মাসিকের যত্ন' })
    expect(r.articles.some((a) => a.titleEn === `${P} bn-search`)).toBe(true)
  })

  it('treats LIKE wildcards in the search term literally', async () => {
    await make({ titleEn: `${P} plain` })
    const r = await listArticles({ q: `${P} %` })
    expect(r.total).toBe(0)
  })
})

describe('listArticles filters', () => {
  it('filters by status', async () => {
    const d = await make({ titleEn: `${P} st-draft`, status: 'DRAFT' })
    const p = await make({ titleEn: `${P} st-pub`, status: 'PUBLISHED' })
    const draft = await listArticles({ q: `${P} st-`, status: 'DRAFT' })
    expect(draft.articles.map((a) => a.id)).toEqual([d.id])
    const pub = await listArticles({ q: `${P} st-`, status: 'PUBLISHED' })
    expect(pub.articles.map((a) => a.id)).toEqual([p.id])
    const all = await listArticles({ q: `${P} st-`, status: 'all' })
    expect(all.total).toBe(2)
  })

  it('filters by category, including none', async () => {
    const cat = await prisma.articleCategory.create({ data: { name: `${P}-cat`, slug: `${P}-cat`.toLowerCase() } })
    categories.push(cat.id)
    const withCat = await make({ titleEn: `${P} cat-yes`, categoryId: cat.id })
    const without = await make({ titleEn: `${P} cat-no` })
    expect((await listArticles({ q: `${P} cat-`, categoryId: cat.id })).articles.map((a) => a.id)).toEqual([withCat.id])
    expect((await listArticles({ q: `${P} cat-`, categoryId: 'none' })).articles.map((a) => a.id)).toEqual([without.id])
  })

  it('filters by cycle phase', async () => {
    const m = await make({ titleEn: `${P} ph-m`, cyclePhases: ['MENSTRUAL', 'LUTEAL'] })
    await make({ titleEn: `${P} ph-f`, cyclePhases: ['FOLLICULAR'] })
    const r = await listArticles({ q: `${P} ph-`, phase: 'MENSTRUAL' })
    expect(r.articles.map((a) => a.id)).toEqual([m.id])
  })

  it('missingBangla matches missing title or missing body, not complete articles', async () => {
    await make({ titleEn: `${P} gap-ok` })
    await make({ titleEn: `${P} gap-notitle`, titleBn: null })
    await make({ titleEn: `${P} gap-nobody`, bodyBn: null })
    await make({ titleEn: `${P} gap-blankbody`, bodyBn: '<p></p>' })
    const a = await make({ titleEn: `${P} gap-cleared` })
    await updateArticle(a.id, { titleBn: '' }, new Date())
    const r = await listArticles({ q: `${P} gap-`, missingBangla: true })
    expect(titles(r)).toEqual([
      `${P} gap-blankbody`, `${P} gap-cleared`, `${P} gap-nobody`, `${P} gap-notitle`,
    ])
    const off = await listArticles({ q: `${P} gap-`, missingBangla: false })
    expect(off.total).toBe(5)
  })

  it('combines filters', async () => {
    const hit = await make({ titleEn: `${P} combo-hit`, status: 'PUBLISHED', cyclePhases: ['OVULATION'], titleBn: null })
    await make({ titleEn: `${P} combo-miss`, status: 'DRAFT', cyclePhases: ['OVULATION'], titleBn: null })
    const r = await listArticles({ q: `${P} combo`, status: 'PUBLISHED', phase: 'OVULATION', missingBangla: true })
    expect(r.articles.map((a) => a.id)).toEqual([hit.id])
  })
})

describe('listArticles pagination and sort', () => {
  it('pages with filters applied and reports totals for the filtered set', async () => {
    for (let i = 0; i < 5; i++) await make({ titleEn: `${P} pg-${i}`, cyclePhases: ['MENSTRUAL'] })
    await make({ titleEn: `${P} pg-other`, cyclePhases: ['LUTEAL'] })
    const p1 = await listArticles({ q: `${P} pg-`, phase: 'MENSTRUAL', page: 1, pageSize: 2, sort: 'title' })
    const p3 = await listArticles({ q: `${P} pg-`, phase: 'MENSTRUAL', page: 3, pageSize: 2, sort: 'title' })
    expect(p1.total).toBe(5)
    expect(p1.totalPages).toBe(3)
    expect(titles(p1)).toEqual([`${P} pg-0`, `${P} pg-1`])
    expect(titles(p3)).toEqual([`${P} pg-4`])
  })

  it('sorts newest first by default', async () => {
    const old = await createArticle(ADMIN_ID, { titleEn: `${P} sort-a`, bodyEn: '<p>x</p>' }, new Date('2020-01-01'))
    created.push(old.id)
    await prisma.article.update({ where: { id: old.id }, data: { createdAt: new Date('2020-01-01') } })
    await make({ titleEn: `${P} sort-b` })
    const r = await listArticles({ q: `${P} sort-` })
    expect(r.articles.map((a) => a.titleEn)).toEqual([`${P} sort-b`, `${P} sort-a`])
  })

  it('clamps nonsense paging instead of crashing', async () => {
    const r = await listArticles({ page: -3, pageSize: 1e6 })
    expect(r.page).toBe(1)
    expect(r.pageSize).toBe(100)
    const z = await listArticles({ page: Number.NaN, pageSize: 0 })
    expect(z.page).toBe(1)
    expect(z.pageSize).toBe(20)
  })

  it('ignores unknown status, phase and sort values', async () => {
    const r = await listArticles({ q: `${P} st-`, status: 'foo', phase: 'BAR', sort: 'nope' } as never)
    expect(r.total).toBeGreaterThan(0)
  })
})

describe('parseArticleListParams (the one URL parser)', () => {
  it('parses a full query string', () => {
    expect(
      parseArticleListParams({
        q: ' hello ', status: 'DRAFT', categoryId: 'c1', phase: 'LUTEAL', missingBangla: '1',
        sort: 'title', page: '2', pageSize: '50',
      }),
    ).toEqual({
      q: 'hello', status: 'DRAFT', categoryId: 'c1', phase: 'LUTEAL', missingBangla: true,
      sort: 'title', page: 2, pageSize: 50,
    })
  })

  it('drops junk values', () => {
    expect(
      parseArticleListParams({ status: 'foo', phase: 'x', page: '-3', pageSize: '1e6', sort: 'zzz', missingBangla: 'maybe' }),
    ).toEqual({ page: 1, pageSize: 100 })
  })

  it('takes the first value of repeated params', () => {
    expect(parseArticleListParams({ q: ['a', 'b'] })).toMatchObject({ q: 'a' })
  })
})

describe('server validation', () => {
  it('refuses an empty or whitespace English title on create and update', async () => {
    await expect(createArticle(ADMIN_ID, { titleEn: '   ', bodyEn: '<p>x</p>' }, new Date())).rejects.toBeInstanceOf(ContentError)
    const a = await make()
    await expect(updateArticle(a.id, { titleEn: '' }, new Date())).rejects.toThrow(/title/i)
  })

  it('refuses an empty English body on create', async () => {
    await expect(createArticle(ADMIN_ID, { titleEn: `${P} nobody`, bodyEn: '<p></p>' }, new Date())).rejects.toThrow(/body/i)
  })

  it('refuses invalid cycle phases', async () => {
    await expect(make({ titleEn: `${P} badphase`, cyclePhases: ['LUTEAL', 'FULL_MOON'] })).rejects.toThrow(/phase/i)
    const a = await make()
    await expect(updateArticle(a.id, { cyclePhases: ['NOPE'] }, new Date())).rejects.toThrow(/phase/i)
  })

  it('refuses a category that does not exist', async () => {
    await expect(make({ titleEn: `${P} badcat`, categoryId: 'does-not-exist' })).rejects.toThrow(/category/i)
    const a = await make()
    await expect(updateArticle(a.id, { categoryId: 'does-not-exist' }, new Date())).rejects.toThrow(/category/i)
  })

  it('writes nothing when validation fails', async () => {
    const before = await prisma.article.count({ where: { titleEn: `${P} atomic` } })
    await make({ titleEn: `${P} atomic`, cyclePhases: ['NOPE'] }).catch(() => {})
    expect(await prisma.article.count({ where: { titleEn: `${P} atomic` } })).toBe(before)
  })
})

describe('contentErrorMessage', () => {
  it('passes ContentError messages through and hides unexpected ones', () => {
    expect(contentErrorMessage(new ContentError('Title is required.'))).toBe('Title is required.')
    expect(contentErrorMessage(new Error('prisma exploded at /secret/path'))).toBe('Something went wrong. Please try again.')
    expect(contentErrorMessage({ code: 'P2002' })).toBe('That name is already in use.')
    expect(contentErrorMessage({ code: 'P2025' })).toBe('That item no longer exists.')
  })
})
