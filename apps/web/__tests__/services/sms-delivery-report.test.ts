import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { recordSmsDeliveryReport } from '@vesta/shared/server/services'

const prisma = new PrismaClient()
const P = `test-smsreport-${Date.now()}`
const adminId = `${P}-admin`
let broadcastId = ''

describe('recordSmsDeliveryReport (db)', () => {
  beforeAll(async () => {
    await prisma.user.create({ data: { id: adminId, email: `${P}@example.com`, fullName: 'Report Admin', authMethod: 'EMAIL', role: 'ADMIN' } })
    // Newest active SENT broadcast: the old fallback target.
    const b = await prisma.smsBroadcast.create({
      data: {
        message: `${P} msg`, sendLanguage: 'EN', status: 'SENT', sentAt: new Date(Date.now() + 60_000),
        active: true, providerMessageId: `${P}-real`, targetCount: 1, deliveredCount: 0, failedCount: 0, createdBy: adminId,
      },
    })
    broadcastId = b.id
  })
  afterAll(async () => {
    await prisma.smsBroadcast.deleteMany({ where: { createdBy: adminId } })
    await prisma.user.deleteMany({ where: { id: adminId } })
    await prisma.$disconnect()
  })

  it('an unknown requestId matches nothing and leaves every broadcast untouched', async () => {
    const res = await recordSmsDeliveryReport(`${P}-bogus`, 'DELIVERED')
    expect(res).toEqual({ matched: false })
    const after = await prisma.smsBroadcast.findUniqueOrThrow({ where: { id: broadcastId } })
    expect(after).toMatchObject({ deliveredCount: 0, failedCount: 0, targetCount: 1 })
  })

  it('a known requestId increments delivered then failed counts', async () => {
    expect(await recordSmsDeliveryReport(`${P}-real`, 'DELIVERED')).toMatchObject({ matched: true, counted: true })
    expect(await recordSmsDeliveryReport(`${P}-real`, 'FAILED')).toMatchObject({ matched: true, counted: true })
    const after = await prisma.smsBroadcast.findUniqueOrThrow({ where: { id: broadcastId } })
    expect(after).toMatchObject({ deliveredCount: 1, failedCount: 1, targetCount: 3 })
  })
})
