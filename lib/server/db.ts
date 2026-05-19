import { PrismaClient } from '@prisma/client'
import { fieldEncryptionExtension } from 'prisma-field-encryption'

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof buildClient> | undefined
}

function buildClient() {
  const base = new PrismaClient()
  return base.$extends(
    fieldEncryptionExtension({
      encryptionKey: process.env.PRISMA_FIELD_ENCRYPTION_KEY,
    }),
  )
}

export const prisma = globalForPrisma.prisma ?? buildClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
