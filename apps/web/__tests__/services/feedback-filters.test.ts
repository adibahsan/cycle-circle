import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { listFeedback, generateFeedbackCsv } from '@vesta/shared/server/services'

const prisma = new PrismaClient()
const P = 'test-fbfilter'
const adminId = `${P}-admin`
const userId = `${P}-user`

const ids = (r: { items: { id: string }[] }) => r.items.map(i => i.id).filter(i => i.startsWith(P)).sort()

describe('feedback list filters (db)', () => {
  beforeAll(async () => {
    await cleanup()
    await prisma.user.create({ data: { id: adminId, email: `${P}-a@example.com`, fullName: 'Admin', authMethod: 'EMAIL', role: 'ADMIN' } })
    await prisma.user.create({ data: { id: userId, email: `${P}-zebra@example.com`, fullName: 'Zebra Tester', authMethod: 'EMAIL' } })
    const mk = (n: string, category: 'BUG' | 'GENERAL', message: string, rating: number | null, day: string) =>
      prisma.feedback.create({ data: { id: `${P}-${n}`, userId, category, message, rating, createdAt: new Date(day) } })
    await mk('a', 'BUG', 'Crash on launch', 5, '2026-01-10T12:00:00Z')
    await mk('b', 'GENERAL', 'Love the app', 3, '2026-02-10T12:00:00Z')
    await mk('c', 'BUG', 'আমার সমস্যা', 4, '2026-03-10T12:00:00Z')
    await mk('d', 'GENERAL', 'No rating here', null, '2026-03-20T12:00:00Z')
  })
  afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
  })
  async function cleanup() {
    await prisma.adminAuditLog.deleteMany({ where: { adminId } })
    await prisma.feedback.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { id: { in: [userId, adminId] } } })
  }
  const all = { pageSize: 100 }

  it('exact rating matches only that rating', async () => {
    expect(ids(await listFeedback({ ...all, rating: 4 }))).toEqual([`${P}-c`])
  })

  it('minRating is at-least', async () => {
    expect(ids(await listFeedback({ ...all, minRating: 4 }))).toEqual([`${P}-a`, `${P}-c`])
  })

  it('date range is inclusive', async () => {
    const r = await listFeedback({ ...all, dateFrom: new Date('2026-02-01'), dateTo: new Date('2026-03-15') })
    expect(ids(r)).toEqual([`${P}-b`, `${P}-c`])
  })

  it('search matches message, user name and email, case-insensitively', async () => {
    expect(ids(await listFeedback({ ...all, search: 'CRASH' }))).toEqual([`${P}-a`])
    expect(ids(await listFeedback({ ...all, search: 'আমার' }))).toEqual([`${P}-c`])
    expect(ids(await listFeedback({ ...all, search: 'zebra tester' }))).toHaveLength(4)
    expect(ids(await listFeedback({ ...all, search: `${P}-zebra@` }))).toHaveLength(4)
  })

  it('search runs across all pages, not just the current one', async () => {
    const r = await listFeedback({ page: 2, pageSize: 1, search: P })
    expect(r.total).toBe(4)
    expect(r.items).toHaveLength(1)
  })

  it('filters combine', async () => {
    expect(ids(await listFeedback({ ...all, category: 'BUG', search: 'launch', minRating: 5 }))).toEqual([`${P}-a`])
  })

  it('export honours the same filters as the list', async () => {
    const filters = { category: 'BUG', rating: 4, search: 'zebra', dateFrom: new Date('2026-03-01') }
    const list = await listFeedback({ ...all, ...filters })
    const csv = await generateFeedbackCsv(adminId, filters)
    expect(ids(list)).toEqual([`${P}-c`])
    expect(csv).toContain(`${P}-c`)
    for (const other of ['a', 'b', 'd']) expect(csv).not.toContain(`${P}-${other}`)
    const csv2 = await generateFeedbackCsv(adminId, { search: 'crash' })
    expect(csv2).toContain(`${P}-a`)
    expect(csv2).not.toContain(`${P}-b`)
  })
})
