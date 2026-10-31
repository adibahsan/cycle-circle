import { describe, it, expect, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createCategory,
  updateCategory,
  getPublishedArticleById,
} from '@vesta/shared/server/services'

const prisma = new PrismaClient()
const created: string[] = []

afterAll(async () => {
  await prisma.article.deleteMany({ where: { categoryId: { in: created } } })
  await prisma.articleCategory.deleteMany({ where: { id: { in: created } } })
  await prisma.$disconnect()
})

describe('ArticleCategory.nameBn', () => {
  it('round-trips through create and update; empty string stores null', async () => {
    const stamp = Date.now()
    const cat = await createCategory(`test-catbn-${stamp}`, 'চক্রের স্বাস্থ্য')
    created.push(cat.id)
    expect(cat.nameBn).toBe('চক্রের স্বাস্থ্য')

    const noBn = await createCategory(`test-catbn-b-${stamp}`, '')
    created.push(noBn.id)
    expect(noBn.nameBn).toBeNull()

    const updated = await updateCategory(cat.id, `test-catbn-${stamp}`, 'পুষ্টি')
    expect(updated.nameBn).toBe('পুষ্টি')

    // omitted nameBn leaves it untouched
    const renamed = await updateCategory(cat.id, `test-catbn-${stamp}-r`)
    expect(renamed.nameBn).toBe('পুষ্টি')

    const cleared = await updateCategory(cat.id, `test-catbn-${stamp}-r`, '')
    expect(cleared.nameBn).toBeNull()
  })

  it('is selected with the published article category', async () => {
    const stamp = Date.now()
    const cat = await createCategory(`test-catbn-art-${stamp}`, 'বিভাগ')
    created.push(cat.id)
    const author = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (!author) return
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
    const got = await getPublishedArticleById(art.id)
    expect(got?.category?.nameBn).toBe('বিভাগ')
  })
})
