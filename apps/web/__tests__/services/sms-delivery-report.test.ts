import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  recordSmsDeliveryReport,
  classifyDeliveryStatus,
  getSmsDeliveryReports,
  setSmsDeliveryReports,
  SMS_DELIVERY_REPORTS_KEY,
} from '@vesta/shared/server/services'

const prisma = new PrismaClient()
const P = `test-smsreport-${Date.now()}`
const adminId = `${P}-admin`
let byRequestId = ''
let legacy = ''

async function sentMessage(day: string, data: Record<string, unknown>) {
  const c = await prisma.smsCampaign.create({
    data: {
      name: `${P} ${day}`,
      createdBy: adminId,
      messages: {
        create: { day: new Date(`${day}T00:00:00Z`), body: `${P} msg`, status: 'SENT', sentAt: new Date(), deliveredCount: 0, failedCount: 0, ...data },
      },
    },
    include: { messages: true },
  })
  return c.messages[0].id
}

describe('recordSmsDeliveryReport (db)', () => {
  beforeAll(async () => {
    await prisma.user.create({ data: { id: adminId, email: `${P}@example.com`, fullName: 'Report Admin', authMethod: 'EMAIL', role: 'ADMIN' } })
    // BDApps reports echo the send's requestId; the first destination messageId is a different value.
    byRequestId = await sentMessage('2044-01-01', {
      providerRequestId: `${P}-req`, providerMessageId: `${P}-msg`, audienceSize: 4,
    })
    // Sent before requestIds were stored: only the messageId is known.
    legacy = await sentMessage('2044-01-02', { providerMessageId: `${P}-old`, audienceSize: 2 })
  })
  afterAll(async () => {
    await prisma.smsCampaign.deleteMany({ where: { createdBy: adminId } })
    await prisma.user.deleteMany({ where: { id: adminId } })
    await prisma.$disconnect()
  })

  it('an unknown id matches nothing and leaves every message untouched', async () => {
    expect(await recordSmsDeliveryReport(`${P}-bogus`, 'DELIVERED')).toEqual({ matched: false })
    const after = await prisma.smsCampaignMessage.findUniqueOrThrow({ where: { id: byRequestId } })
    expect(after).toMatchObject({ deliveredCount: 0, failedCount: 0, audienceSize: 4 })
  })

  it('correlates on providerRequestId and bumps delivered then failed counts', async () => {
    expect(await recordSmsDeliveryReport(`${P}-req`, 'DELIVERED')).toMatchObject({ matched: true, counted: true })
    expect(await recordSmsDeliveryReport(`${P}-req`, 'failed')).toMatchObject({ matched: true, counted: true })
    const after = await prisma.smsCampaignMessage.findUniqueOrThrow({ where: { id: byRequestId } })
    expect(after).toMatchObject({ deliveredCount: 1, failedCount: 1, audienceSize: 4 }) // audience is the size at send time
  })

  it('falls back to providerMessageId for rows without a requestId', async () => {
    expect(await recordSmsDeliveryReport(`${P}-old`, 'DELIVERED')).toMatchObject({ matched: true, counted: true })
    const after = await prisma.smsCampaignMessage.findUniqueOrThrow({ where: { id: legacy } })
    expect(after.deliveredCount).toBe(1)
  })

  it('counts concurrent reports without losing any, even from a null counter', async () => {
    await prisma.smsCampaignMessage.update({ where: { id: legacy }, data: { deliveredCount: null } })
    await Promise.all(Array.from({ length: 5 }, () => recordSmsDeliveryReport(`${P}-old`, 'DELIVERED')))
    const after = await prisma.smsCampaignMessage.findUniqueOrThrow({ where: { id: legacy } })
    expect(after.deliveredCount).toBe(5)
  })

  it('a pending report is matched but not counted', async () => {
    expect(await recordSmsDeliveryReport(`${P}-req`, 'PENDING')).toEqual({ matched: true, counted: false })
  })

  it('counts the BDApps terminal failure statuses as failed, and in-flight or unknown ones as neither', async () => {
    const before = await prisma.smsCampaignMessage.findUniqueOrThrow({ where: { id: byRequestId } })
    for (const status of ['EXPIRED', 'DELETED', 'UNDELIVERABLE', 'REJECTED']) {
      expect(await recordSmsDeliveryReport(`${P}-req`, status)).toMatchObject({ matched: true, counted: true })
    }
    for (const status of ['ACCEPTED', 'UNKNOWN', 'SomethingNew', '']) {
      expect(await recordSmsDeliveryReport(`${P}-req`, status)).toEqual({ matched: true, counted: false })
    }
    const after = await prisma.smsCampaignMessage.findUniqueOrThrow({ where: { id: byRequestId } })
    expect(after.failedCount).toBe((before.failedCount ?? 0) + 4)
    expect(after.deliveredCount).toBe(before.deliveredCount)
  })
})

describe('classifyDeliveryStatus', () => {
  it('maps the documented BDApps statuses and the vendor-sample spellings', () => {
    expect(classifyDeliveryStatus('DELIVERED')).toBe('delivered')
    expect(classifyDeliveryStatus('DeliveredToTerminal')).toBe('delivered')
    expect(classifyDeliveryStatus('delivered')).toBe('delivered')
    for (const s of ['FAILED', 'EXPIRED', 'DELETED', 'UNDELIVERABLE', 'REJECTED', 'DeliveryImpossible']) {
      expect(classifyDeliveryStatus(s)).toBe('failed')
    }
    for (const s of ['ACCEPTED', 'UNKNOWN', 'PENDING', 'DeliveryUncertain', '', null, undefined]) {
      expect(classifyDeliveryStatus(s)).toBe('unknown')
    }
  })
})

describe('delivery-report switch (db)', () => {
  afterAll(async () => {
    await prisma.systemSetting.deleteMany({ where: { key: SMS_DELIVERY_REPORTS_KEY } })
  })
  it('is off by default and when the value is corrupt, and round-trips on and off', async () => {
    await prisma.systemSetting.deleteMany({ where: { key: SMS_DELIVERY_REPORTS_KEY } })
    expect(await getSmsDeliveryReports()).toBe(false)
    expect(await setSmsDeliveryReports(true)).toEqual({ previous: false, enabled: true })
    expect(await getSmsDeliveryReports()).toBe(true)
    expect(await setSmsDeliveryReports(false)).toEqual({ previous: true, enabled: false })
    expect(await getSmsDeliveryReports()).toBe(false)
    await prisma.systemSetting.update({ where: { key: SMS_DELIVERY_REPORTS_KEY }, data: { value: 'garbage' } })
    expect(await getSmsDeliveryReports()).toBe(false)
  })
})
