import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createArticle, updateArticle, bulkArticleAction } from '@vesta/shared/server/services'
import { AUDIT_ACTIONS } from '@vesta/shared/server/services/audit-actions'

const prisma = new PrismaClient()
const ADMIN_ID = 'test-bulk-admin'
const created: string[] = []
const categories: string[] = []

async function make(status = 'DRAFT') {
  const a = await createArticle(
    ADMIN_ID,
    { titleEn: 'Bulk article', bodyEn: '<p>en</p>', status },
    new Date(),
  )
  created.push(a.id)
  return a
}

async function row(id: string) {
  return prisma.article.findUniqueOrThrow({ where: { id } })
}

beforeAll(async () => {
  await prisma.user.create({
    data: { id: ADMIN_ID, phone: '+8801700099002', fullName: 'Bulk Admin', authMethod: 'OTP', profileCompleted: true },
  })
})

afterAll(async () => {
  await prisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN_ID } })
  await prisma.article.deleteMany({ where: { id: { in: created } } })
  await prisma.articleCategory.deleteMany({ where: { id: { in: categories } } })
  await prisma.user.delete({ where: { id: ADMIN_ID } })
  await prisma.$disconnect()
})

describe('bulkArticleAction', () => {
  it('publishes valid ids, fails an unknown id alone, and returns per-id results', async () => {
    const a = await make()
    const b = await make()
    const before = Date.now()
    const { results } = await bulkArticleAction(ADMIN_ID, [a.id, 'missing-id', b.id], { type: 'publish' }, new Date())

    expect(results.map((r) => r.id)).toEqual([a.id, 'missing-id', b.id])
    expect(results[0]).toEqual({ id: a.id, ok: true })
    expect(results[2]).toEqual({ id: b.id, ok: true })
    const bad = results[1]
    expect(bad.ok).toBe(false)
    expect(bad.ok === false && bad.error.length).toBeGreaterThan(0)

    const ra = await row(a.id)
    expect(ra.status).toBe('PUBLISHED')
    expect(ra.publishedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000)
  })

  it('publish overrides a future publishedAt (publishes immediately)', async () => {
    const a = await make('PUBLISHED')
    await prisma.article.update({ where: { id: a.id }, data: { publishedAt: new Date(Date.now() + 86_400_000) } })
    await bulkArticleAction(ADMIN_ID, [a.id], { type: 'publish' }, new Date())
    expect((await row(a.id)).publishedAt!.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('unpublish returns to draft and clears publishedAt', async () => {
    const a = await make('PUBLISHED')
    const { results } = await bulkArticleAction(ADMIN_ID, [a.id], { type: 'unpublish' }, new Date())
    expect(results).toEqual([{ id: a.id, ok: true }])
    const r = await row(a.id)
    expect(r.status).toBe('DRAFT')
    expect(r.publishedAt).toBeNull()
  })

  it('archives', async () => {
    const a = await make('PUBLISHED')
    await bulkArticleAction(ADMIN_ID, [a.id], { type: 'archive' }, new Date())
    const r = await row(a.id)
    expect(r.status).toBe('ARCHIVED')
    expect(r.publishedAt).toBeNull()
  })

  it('moves to a category and to uncategorised (null)', async () => {
    const cat = await prisma.articleCategory.create({ data: { name: 'bulk-cat', slug: 'bulk-cat' } })
    categories.push(cat.id)
    const a = await make()
    await bulkArticleAction(ADMIN_ID, [a.id], { type: 'move', categoryId: cat.id }, new Date())
    expect((await row(a.id)).categoryId).toBe(cat.id)
    await bulkArticleAction(ADMIN_ID, [a.id], { type: 'move', categoryId: null }, new Date())
    expect((await row(a.id)).categoryId).toBeNull()
  })

  it('move to a missing category fails every id and changes nothing', async () => {
    const a = await make()
    const { results } = await bulkArticleAction(ADMIN_ID, [a.id], { type: 'move', categoryId: 'nope' }, new Date())
    expect(results[0].ok).toBe(false)
    expect((await row(a.id)).categoryId).toBeNull()
  })

  it('writes exactly one ARTICLE_BULK_ACTION audit row with action, ids, succeeded and failed', async () => {
    const a = await make()
    const b = await make()
    await prisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN_ID } })
    await bulkArticleAction(ADMIN_ID, [a.id, b.id, 'ghost'], { type: 'archive' }, new Date())
    const rows = await prisma.adminAuditLog.findMany({ where: { adminId: ADMIN_ID } })
    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe(AUDIT_ACTIONS.ARTICLE_BULK_ACTION)
    const meta = rows[0].metadata as { action: string; ids: string[]; succeeded: string[]; failed: string[] }
    expect(meta.action).toBe('archive')
    expect(meta.ids).toEqual([a.id, b.id, 'ghost'])
    expect(meta.succeeded).toEqual([a.id, b.id])
    expect(meta.failed).toEqual(['ghost'])
  })

  it('dedupes repeated ids', async () => {
    const a = await make()
    const { results } = await bulkArticleAction(ADMIN_ID, [a.id, a.id], { type: 'publish' }, new Date())
    expect(results).toEqual([{ id: a.id, ok: true }])
  })
})

describe('updateArticle audit', () => {
  it('writes an ARTICLE_UPDATED row when an admin id is given', async () => {
    const a = await make()
    await updateArticle(a.id, { titleEn: 'Renamed' }, new Date(), ADMIN_ID)
    const rows = await prisma.adminAuditLog.findMany({
      where: { adminId: ADMIN_ID, action: AUDIT_ACTIONS.ARTICLE_UPDATED, targetId: a.id },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].targetType).toBe('Article')
  })
})
