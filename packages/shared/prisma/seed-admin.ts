import type { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

export const DEV_ADMIN_PASSWORD = 'admin123'

/** Throws when running in production without a strong ADMIN_PASSWORD. Pure: writes nothing. */
export function assertSeedAdminConfig({ password, nodeEnv }: { password?: string; nodeEnv?: string }): void {
  if (nodeEnv === 'production' && (!password || password === DEV_ADMIN_PASSWORD)) {
    throw new Error('ADMIN_PASSWORD must be set to a strong value when NODE_ENV=production')
  }
}

/** Creates the admin only if missing. An existing row (any role/password) is never modified. */
export async function ensureAdminUser(
  prisma: PrismaClient,
  { email, password, nodeEnv }: { email: string; password?: string; nodeEnv?: string },
): Promise<{ status: 'created' | 'exists'; id: string }> {
  assertSeedAdminConfig({ password, nodeEnv })

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) return { status: 'exists', id: existing.id }

  const passwordHash = await bcrypt.hash(password || DEV_ADMIN_PASSWORD, 12)
  const created = await prisma.user.create({
    data: {
      email,
      fullName: 'Super Admin',
      authMethod: 'EMAIL',
      role: 'ADMIN',
      passwordHash,
      profileCompleted: true,
    },
    select: { id: true },
  })
  return { status: 'created', id: created.id }
}
