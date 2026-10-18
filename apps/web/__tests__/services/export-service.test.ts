import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  toCsv,
  generateFeedbackCsv,
  generateUsersCsv,
} from '@vesta/shared/server/services'

const BOM = '﻿'
const prisma = new PrismaClient()
const P = 'test-export'

describe('toCsv', () => {
  it('starts with a UTF-8 BOM', () => {
    expect(toCsv(['a'], [['x']]).startsWith(BOM)).toBe(true)
  })

  it('keeps Bengali text intact', () => {
    expect(toCsv(['a'], [['আমার ডেটা']])).toContain('আমার ডেটা')
  })

  it('quotes commas, quotes and newlines per RFC 4180', () => {
    const csv = toCsv(['h'], [['a,b'], ['say "hi"'], ['l1\nl2']])
    expect(csv).toContain('"a,b"')
    expect(csv).toContain('"say ""hi"""')
    expect(csv).toContain('"l1\nl2"')
  })

  it('uses CRLF row separators', () => {
    expect(toCsv(['h'], [['a']])).toBe(`${BOM}h\r\na`)
  })

  it('prefixes formula cells with a single quote', () => {
    const csv = toCsv(['h'], [['=SUM(A1)'], ['+1'], ['-1'], ['@x'], ['safe']])
    expect(csv).toContain("'=SUM(A1)")
    expect(csv).toContain("'+1")
    expect(csv).toContain("'-1")
    expect(csv).toContain("'@x")
    expect(csv).toContain('\r\nsafe')
  })

  it('renders null/undefined as empty, dates as ISO, numbers as-is', () => {
    const csv = toCsv(['a', 'b', 'c', 'd'], [[null, undefined, new Date('2026-01-02T03:04:05Z'), 5]])
    expect(csv.endsWith(',,2026-01-02T03:04:05.000Z,5')).toBe(true)
  })
})

describe('exports (db)', () => {
  const adminId = `${P}-admin`
  const userId = `${P}-user`
  const profileId = `${P}-profile`

  beforeAll(async () => {
    await cleanup()
    await prisma.user.create({
      data: { id: adminId, email: `${P}-admin@example.com`, fullName: 'Admin', authMethod: 'EMAIL', role: 'ADMIN' },
    })
    await prisma.user.create({
      data: { id: userId, email: `${P}-u@example.com`, fullName: '=cmd|evil', authMethod: 'EMAIL' },
    })
    await prisma.feedback.create({
      data: { id: `${P}-fb`, userId, profileId, category: 'BUG', message: 'বাংলা, "quoted"\nline2', rating: 4 },
    })
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

  it('feedback export has all columns incl. user id and profile id, BOM, safe cells', async () => {
    const csv = await generateFeedbackCsv(adminId)
    const header = csv.slice(1).split('\r\n')[0]
    expect(csv.startsWith(BOM)).toBe(true)
    expect(header).toBe('ID,User ID,Profile ID,User,Email,Category,Message,Rating,Date')
    expect(csv).toContain(userId)
    expect(csv).toContain(profileId)
    expect(csv).toContain('"বাংলা, ""quoted""\nline2"')
    expect(csv).toContain("'=cmd|evil")
  })

  it('feedback export honours filters', async () => {
    const csv = await generateFeedbackCsv(adminId, { category: 'GENERAL' })
    expect(csv).not.toContain(`${P}-fb`)
    const csv2 = await generateFeedbackCsv(adminId, { category: 'BUG', minRating: 4 })
    expect(csv2).toContain(`${P}-fb`)
  })

  it('users export has BOM, escapes cells and lists the user', async () => {
    const csv = await generateUsersCsv(adminId)
    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv.slice(1).split('\r\n')[0]).toBe(
      'ID,Name,Phone,Email,Auth Method,Subscription,Role,Profiles,Profile Complete,Created,Last Login',
    )
    expect(csv).toContain(userId)
    expect(csv).toContain("'=cmd|evil")
  })

  it('each export writes an audit-log entry', async () => {
    await prisma.adminAuditLog.deleteMany({ where: { adminId } })
    await generateFeedbackCsv(adminId)
    await generateUsersCsv(adminId)
    const logs = await prisma.adminAuditLog.findMany({ where: { adminId } })
    expect(logs.map(l => l.action).sort()).toEqual(['EXPORT_FEEDBACK_CSV', 'EXPORT_USERS_CSV'])
  })
})
