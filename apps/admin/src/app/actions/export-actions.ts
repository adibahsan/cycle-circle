'use server'

import { prisma } from '@vesta/shared'
import { requireAdminAuth } from '@vesta/shared/server/auth'

export async function exportFeedbackCsv() {
  await requireAdminAuth()

  const items = await prisma.feedback.findMany({
    include: { user: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const header = 'ID,User,Email,Category,Message,Rating,Date'
  const rows = items.map(f => {
    const message = f.message.replace(/"/g, '""')
    return `${f.id},"${f.user.fullName ?? ''}","${f.user.email ?? ''}",${f.category},"${message}",${f.rating ?? ''},${f.createdAt.toISOString()}`
  })

  return [header, ...rows].join('\n')
}

export async function exportUsersCsv() {
  await requireAdminAuth()

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      authMethod: true,
      subscriptionStatus: true,
      role: true,
      profileCompleted: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { profiles: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const header =
    'ID,Name,Phone,Email,Auth Method,Subscription,Role,Profiles,Profile Complete,Created,Last Login'
  const rows = users.map(
    u =>
      `${u.id},"${u.fullName ?? ''}","${u.phone ?? ''}","${u.email ?? ''}",${u.authMethod},${u.subscriptionStatus},${u.role},${u._count.profiles},${u.profileCompleted},${u.createdAt.toISOString()},${u.lastLoginAt?.toISOString() ?? ''}`,
  )

  return [header, ...rows].join('\n')
}
