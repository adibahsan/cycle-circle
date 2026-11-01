import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createArticle, updateArticle, ContentError } from '@vesta/shared/server/services'
import { articlePublishWarnings } from '@vesta/shared/utils/article-warnings'

const prisma = new PrismaClient()
const ADMIN_ID = 'test-art-admin'
const created: string[] = []

async function make(data: Partial<Parameters<typeof createArticle>[1]> = {}) {
  const a = await createArticle(ADMIN_ID, {
    titleEn: 'Test article',
    bodyEn: '<p>en</p>',
    titleBn: 'শিরোনাম',
    bodyBn: '<p>বাংলা</p>',
    cyclePhases: ['LUTEAL'],
    ...data,
  }, new Date())
  created.push(a.id)
  return a
}

beforeAll(async () => {
  await prisma.user.create({
    data: { id: ADMIN_ID, phone: '+8801700099001', fullName: 'Art Admin', authMethod: 'OTP', profileCompleted: true },
  })
})

afterAll(async () => {
  await prisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN_ID } })
  await prisma.article.deleteMany({ where: { id: { in: created } } })
  await prisma.user.delete({ where: { id: ADMIN_ID } })
  await prisma.$disconnect()
})

describe('updateArticle clearing', () => {
  it('clears Bengali title, Bengali body and category when null/empty is sent', async () => {
    const cat = await prisma.articleCategory.create({ data: { name: 'test-art-cat', slug: 'test-art-cat' } })
    try {
      const a = await make({ categoryId: cat.id })
      const updated = await updateArticle(a.id, { titleBn: null, bodyBn: '<p></p>', categoryId: null }, new Date())
      expect(updated.titleBn).toBeNull()
      expect(updated.bodyBn).toBeNull()
      expect(updated.categoryId).toBeNull()

      const b = await make({ categoryId: cat.id })
      const u2 = await updateArticle(b.id, { titleBn: '', bodyBn: '', categoryId: '' }, new Date())
      expect(u2.titleBn).toBeNull()
      expect(u2.bodyBn).toBeNull()
      expect(u2.categoryId).toBeNull()
    } finally {
      await prisma.article.updateMany({ where: { categoryId: cat.id }, data: { categoryId: null } })
      await prisma.articleCategory.delete({ where: { id: cat.id } })
    }
  })

  it('leaves fields untouched when undefined', async () => {
    const a = await make()
    const updated = await updateArticle(a.id, { titleEn: 'New title' }, new Date())
    expect(updated.titleBn).toBe('শিরোনাম')
    expect(updated.bodyBn).toContain('বাংলা')
  })
})

describe('article status validation', () => {
  it('rejects an unknown status on update and create', async () => {
    const a = await make()
    await expect(updateArticle(a.id, { status: 'BOGUS' }, new Date())).rejects.toThrow(/status/i)
    await expect(createArticle(ADMIN_ID, { titleEn: 'x', bodyEn: '<p>x</p>', status: 'nope' }, new Date())).rejects.toThrow(/status/i)
  })

  it('accepts valid statuses', async () => {
    const a = await make()
    const u = await updateArticle(a.id, { status: 'PUBLISHED' }, new Date())
    expect(u.status).toBe('PUBLISHED')
    expect(u.publishedAt).not.toBeNull()
  })
})

describe('articlePublishWarnings', () => {
  it('warns for missing Bengali and missing phase only when publishing', () => {
    expect(articlePublishWarnings({ status: 'DRAFT', titleBn: '', bodyBn: '', cyclePhases: [] })).toEqual([])
    expect(articlePublishWarnings({ status: 'PUBLISHED', titleBn: 'a', bodyBn: '<p>b</p>', cyclePhases: ['LUTEAL'] })).toEqual([])
    expect(articlePublishWarnings({ status: 'PUBLISHED', titleBn: '', bodyBn: '<p></p>', cyclePhases: [] })).toEqual(['bengali', 'phase'])
    expect(articlePublishWarnings({ status: 'PUBLISHED', titleBn: 'a', bodyBn: '', cyclePhases: ['LUTEAL'] })).toEqual(['bengali'])
  })
})

describe('invalid status', () => {
  it('is a ContentError with the same message', async () => {
    const p = createArticle('x', { titleEn: 't', bodyEn: '<p>b</p>', status: 'BOGUS' }, new Date())
    await expect(p).rejects.toBeInstanceOf(ContentError)
    await expect(p).rejects.toThrow('Invalid article status "BOGUS". Expected one of DRAFT, PUBLISHED, ARCHIVED.')
  })
})
