import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createCategory,
  updateCategory,
  removeCategory,
  listCategories,
  reorderCategories,
  ContentError,
} from '@vesta/shared/server/services'

const prisma = new PrismaClient()
const ADMIN_ID = 'test-catord-admin'
const created: string[] = []
const stamp = Date.now()

async function make(name: string, nameBn?: string) {
  const c = await createCategory(ADMIN_ID, name, nameBn)
  created.push(c.id)
  return c
}

/** Our own categories, in the order listCategories returns them (other test files add rows too). */
async function ownOrder() {
  const all = await listCategories()
  return all.filter((c) => created.includes(c.id)).map((c) => c.id)
}

beforeAll(async () => {
  await prisma.user.create({
    data: { id: ADMIN_ID, phone: '+8801700099217', fullName: 'Cat Admin', authMethod: 'OTP', profileCompleted: true },
  })
})

afterAll(async () => {
  await prisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN_ID } })
  await prisma.articleCategory.deleteMany({ where: { id: { in: created } } })
  await prisma.user.delete({ where: { id: ADMIN_ID } })
  await prisma.$disconnect()
})

describe('category slugs', () => {
  it('gives two Bangla-only names distinct, non-empty slugs', async () => {
    const a = await make(`বিভাগ ক ${stamp}`)
    const b = await make(`বিভাগ খ ${stamp}`)
    expect(a.slug).toBeTruthy()
    expect(b.slug).toBeTruthy()
    expect(a.slug).not.toBe(b.slug)
  })

  it('keeps the plain slug for an English name', async () => {
    const c = await make(`Test Catord Health ${stamp}`)
    expect(c.slug).toBe(`test-catord-health-${stamp}`)
  })
})

describe('category order', () => {
  it('appends new categories last, then reorder persists and listing follows', async () => {
    const x = await make(`test-catord-x-${stamp}`)
    const y = await make(`test-catord-y-${stamp}`)
    const z = await make(`test-catord-z-${stamp}`)
    const before = await ownOrder()
    expect(before.indexOf(x.id)).toBeLessThan(before.indexOf(y.id))
    expect(before.indexOf(y.id)).toBeLessThan(before.indexOf(z.id))

    const all = (await listCategories()).map((c) => c.id)
    const next = [z.id, ...all.filter((id) => id !== z.id)]
    await reorderCategories(ADMIN_ID, next)

    const after = await ownOrder()
    expect(after.indexOf(z.id)).toBe(0)
    expect((await listCategories())[0].id).toBe(z.id)
  })

  it('rejects a reorder that does not list every category', async () => {
    const all = (await listCategories()).map((c) => c.id)
    await expect(reorderCategories(ADMIN_ID, all.slice(1))).rejects.toThrow(/reload/i)
  })
})

describe('category audit rows', () => {
  it('records created, renamed, reordered and deleted with names', async () => {
    const c = await make(`test-catord-aud-${stamp}`, 'অডিট')
    await updateCategory(ADMIN_ID, c.id, `test-catord-aud2-${stamp}`)
    const all = (await listCategories()).map((x) => x.id)
    await reorderCategories(ADMIN_ID, [...all].reverse())
    await removeCategory(ADMIN_ID, c.id)

    const rows = await prisma.adminAuditLog.findMany({
      where: { adminId: ADMIN_ID, targetType: 'ArticleCategory', targetId: c.id },
    })
    const actions = rows.map((r) => r.action)
    expect(actions).toEqual(expect.arrayContaining(['CATEGORY_CREATED', 'CATEGORY_RENAMED', 'CATEGORY_DELETED']))
    const renamed = rows.find((r) => r.action === 'CATEGORY_RENAMED')!
    expect(renamed.metadata).toMatchObject({ from: `test-catord-aud-${stamp}`, to: `test-catord-aud2-${stamp}` })
    const deleted = rows.find((r) => r.action === 'CATEGORY_DELETED')!
    expect(deleted.metadata).toMatchObject({ name: `test-catord-aud2-${stamp}` })

    const reorders = await prisma.adminAuditLog.findMany({
      where: { adminId: ADMIN_ID, action: 'CATEGORY_REORDERED' },
    })
    expect(reorders.length).toBeGreaterThan(0)
  })
})

describe('admin-safe errors are ContentErrors', () => {
  it('uses ContentError for every category failure', async () => {
    const c = await make(`test-catord-err-${stamp}`)
    const all = (await listCategories()).map((x) => x.id)
    await expect(createCategory(ADMIN_ID, '   ')).rejects.toBeInstanceOf(ContentError)
    await expect(createCategory(ADMIN_ID, c.name)).rejects.toBeInstanceOf(ContentError)
    await expect(updateCategory(ADMIN_ID, 'missing-cat', 'x')).rejects.toBeInstanceOf(ContentError)
    await expect(removeCategory(ADMIN_ID, 'missing-cat')).rejects.toBeInstanceOf(ContentError)
    await expect(reorderCategories(ADMIN_ID, all.slice(1))).rejects.toBeInstanceOf(ContentError)
  })
})

describe('duplicate names', () => {
  it('returns a readable error, not a Prisma message', async () => {
    const c = await make(`test-catord-dup-${stamp}`)
    await expect(createCategory(ADMIN_ID, c.name)).rejects.toThrow(/already exists/i)
    const other = await make(`test-catord-dup2-${stamp}`)
    await expect(updateCategory(ADMIN_ID, other.id, c.name)).rejects.toThrow(/already exists/i)
  })
})
