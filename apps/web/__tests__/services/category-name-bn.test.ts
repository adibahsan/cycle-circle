import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createCategory,
  updateCategory,
  getPublishedArticleById,
} from '@vesta/shared/server/services'

const prisma = new PrismaClient()
const created: string[] = []
// Own author: picking any ADMIN races other test files that create and delete admins.
const AUTHOR = 'test-catbn-author'

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: AUTHOR },
    update: {},
    create: { id: AUTHOR, email: `${AUTHOR}@example.test`, role: 'ADMIN', authMethod: 'EMAIL' },
  })
})

afterAll(async () => {
  await prisma.adminAuditLog.deleteMany({ where: { adminId: AUTHOR } })
  await prisma.article.deleteMany({ where: { categoryId: { in: created } } })
  await prisma.articleCategory.deleteMany({ where: { id: { in: created } } })
  await prisma.user.deleteMany({ where: { id: AUTHOR } })
  await prisma.$disconnect()
})

describe('Bangla-only category rename', () => {
  it('writes a rename audit row with old and new for both names', async () => {
    const stamp = Date.now()
    const cat = await createCategory(AUTHOR, `test-catbn-aud-${stamp}`, 'পুরনো')
    created.push(cat.id)
    await updateCategory(AUTHOR, cat.id, cat.name, 'নতুন')
    const rows = await prisma.adminAuditLog.findMany({
      where: { adminId: AUTHOR, action: 'CATEGORY_RENAMED', targetId: cat.id },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].metadata).toMatchObject({ from: cat.name, to: cat.name, fromBn: 'পুরনো', toBn: 'নতুন' })
  })

  it('writes no rename row when neither name changes', async () => {
    const cat = await createCategory(AUTHOR, `test-catbn-same-${Date.now()}`, 'একই')
    created.push(cat.id)
    await updateCategory(AUTHOR, cat.id, cat.name, 'একই')
    expect(await prisma.adminAuditLog.count({ where: { adminId: AUTHOR, action: 'CATEGORY_RENAMED', targetId: cat.id } })).toBe(0)
  })
})

describe('ArticleCategory.nameBn', () => {
  it('round-trips through create and update; empty string stores null', async () => {
    const stamp = Date.now()
    const cat = await createCategory(AUTHOR, `test-catbn-${stamp}`, 'চক্রের স্বাস্থ্য')
    created.push(cat.id)
    expect(cat.nameBn).toBe('চক্রের স্বাস্থ্য')

    const noBn = await createCategory(AUTHOR, `test-catbn-b-${stamp}`, '')
    created.push(noBn.id)
    expect(noBn.nameBn).toBeNull()

    const updated = await updateCategory(AUTHOR, cat.id, `test-catbn-${stamp}`, 'পুষ্টি')
    expect(updated.nameBn).toBe('পুষ্টি')

    // omitted nameBn leaves it untouched
    const renamed = await updateCategory(AUTHOR, cat.id, `test-catbn-${stamp}-r`)
    expect(renamed.nameBn).toBe('পুষ্টি')

    const cleared = await updateCategory(AUTHOR, cat.id, `test-catbn-${stamp}-r`, '')
    expect(cleared.nameBn).toBeNull()
  })

  it('is selected with the published article category', async () => {
    const stamp = Date.now()
    const cat = await createCategory(AUTHOR, `test-catbn-art-${stamp}`, 'বিভাগ')
    created.push(cat.id)
    const author = await prisma.user.upsert({
      where: { id: AUTHOR },
      update: {},
      create: { id: AUTHOR, email: `${AUTHOR}@example.test`, role: 'ADMIN', authMethod: 'EMAIL' },
    })
    const art = await prisma.article.create({
      data: {
        slug: `test-catbn-${stamp}`,
        titleEn: 't',
        bodyEn: '<p>x</p>',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        categoryId: cat.id,
        authorId: author.id,
      },
    })
    const got = await getPublishedArticleById(art.id, new Date())
    expect(got?.category?.nameBn).toBe('বিভাগ')
  })
})
