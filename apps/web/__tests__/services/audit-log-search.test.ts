import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createAuditLog, listAuditLogs } from '@vesta/shared/server/services'

const prisma = new PrismaClient()
const P = 'test-auditsearch'
const adminId = `${P}-admin`

const mine = (r: { logs: { adminId: string; targetId: string }[] }) =>
  r.logs.filter(l => l.adminId === adminId).map(l => l.targetId).sort()

describe('audit log search (db)', () => {
  beforeAll(async () => {
    await cleanup()
    await prisma.user.create({ data: { id: adminId, email: `${P}-a@example.com`, fullName: 'Audit Searcher', authMethod: 'EMAIL', role: 'ADMIN' } })
    await createAuditLog(adminId, 'SUSPEND_USER', 'USER', `${P}-t1`)
    await createAuditLog(adminId, 'GRANT_PRO', 'USER', `${P}-t2`)
    await createAuditLog(adminId, 'CREATE_ARTICLE', 'ARTICLE', `${P}-t3`)
  })
  afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
  })
  async function cleanup() {
    await prisma.adminAuditLog.deleteMany({ where: { adminId } })
    await prisma.user.deleteMany({ where: { id: adminId } })
  }

  it('search matches action, case-insensitive, partial', async () => {
    expect(mine(await listAuditLogs({ pageSize: 100, search: 'suspend' }))).toEqual([`${P}-t1`])
    expect(mine(await listAuditLogs({ pageSize: 100, search: 'SUSPEND USER' }))).toEqual([`${P}-t1`])
  })

  it('search matches target id', async () => {
    expect(mine(await listAuditLogs({ pageSize: 100, search: `${P}-t3` }))).toEqual([`${P}-t3`])
  })

  it('search combines with filters', async () => {
    expect(mine(await listAuditLogs({ pageSize: 100, search: P, targetType: 'ARTICLE' }))).toEqual([`${P}-t3`])
  })

  it('blank search is ignored', async () => {
    expect(mine(await listAuditLogs({ pageSize: 100, search: '  ' }))).toHaveLength(3)
  })
})
