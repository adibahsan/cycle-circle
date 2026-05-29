import { cache } from 'react'
import { prisma } from '@vesta/shared'
import { requireCurrentUser } from './auth-queries'

export const getProfiles = cache(async () => {
  const user = await requireCurrentUser()
  return prisma.profile.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  })
})

export const getProfile = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== user.id) return null

  const prediction = await prisma.prediction.findUnique({
    where: { profileId: profile.id },
  })

  return { profile, prediction }
})
