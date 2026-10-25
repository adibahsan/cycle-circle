/**
 * Prisma against this slot's `vesta_e2e*` database for setup only (states the UI
 * can't reach in time). Do not import `@vesta/shared`'s `prisma` — that reads
 * `DATABASE_URL` from the process env and would hit `vesta_dev`.
 */
import {
  PrismaClient,
  type ArticleStatus,
  type CyclePhase,
  type FlowIntensity,
  type Prisma,
  type SubscriptionStatus,
  type SymptomCategory,
} from '@prisma/client'
import { TEST_DATABASE_URL, DATABASE_URL, assertE2eDatabase, SECRETS } from './slot.ts'
import { bangladeshDays, type BangladeshDays } from './bangladesh-day.ts'

const dbUrl = TEST_DATABASE_URL ?? DATABASE_URL
assertE2eDatabase(dbUrl)

let client: PrismaClient | null = null

/** Shared Prisma client for this process, locked to the E2E database. */
export function e2eDb(): PrismaClient {
  if (!client) {
    client = new PrismaClient({ datasourceUrl: dbUrl })
  }
  return client
}

/** Alias used by web login specs / the `db` fixture (#120). */
export function getE2eDb(): PrismaClient {
  return e2eDb()
}

export function getDb(): PrismaClient {
  return e2eDb()
}

export const db = getE2eDb()
export type { PrismaClient }

/** Disconnect the shared client (worker teardown). Safe to call when unused. */
export async function closeE2eDb(): Promise<void> {
  if (!client) return
  const toClose = client
  client = null
  await toClose.$disconnect()
}

/**
 * Creates an article in the slot database for content tests.
 */
export async function createArticle(opts: {
  slug: string
  titleEn: string
  titleBn?: string
  bodyEn: string
  bodyBn?: string
  status?: ArticleStatus
  cyclePhases?: CyclePhase[]
  categoryName?: string
}) {
  const db = getDb()
  let author = await db.user.findFirst({ where: { role: 'ADMIN' } })
  if (!author) {
    author = await db.user.create({
      data: {
        email: SECRETS.adminEmail,
        role: 'ADMIN',
        authMethod: 'EMAIL',
        passwordHash: 'dummy',
      },
    })
  }

  let categoryId: string | undefined
  if (opts.categoryName) {
    const slug = opts.categoryName.toLowerCase().replace(/\s+/g, '-')
    let cat = await db.articleCategory.findFirst({ where: { name: opts.categoryName } })
    if (!cat) {
      try {
        cat = await db.articleCategory.create({
          data: { name: opts.categoryName, slug },
        })
      } catch {
        cat = await db.articleCategory.findFirst({ where: { name: opts.categoryName } })
      }
    }
    categoryId = cat?.id
  }

  return db.article.upsert({
    where: { slug: opts.slug },
    update: {
      titleEn: opts.titleEn,
      titleBn: opts.titleBn,
      bodyEn: opts.bodyEn,
      bodyBn: opts.bodyBn,
      status: opts.status ?? 'PUBLISHED',
      cyclePhases: opts.cyclePhases ?? [],
      categoryId,
      publishedAt: (opts.status ?? 'PUBLISHED') === 'PUBLISHED' ? new Date() : null,
    },
    create: {
      slug: opts.slug,
      titleEn: opts.titleEn,
      titleBn: opts.titleBn,
      bodyEn: opts.bodyEn,
      bodyBn: opts.bodyBn,
      status: opts.status ?? 'PUBLISHED',
      cyclePhases: opts.cyclePhases ?? [],
      authorId: author.id,
      categoryId,
      publishedAt: (opts.status ?? 'PUBLISHED') === 'PUBLISHED' ? new Date() : null,
    },
  })
}

/**
 * Adds a profile with period and symptom logs for a user, so export and profile tests have data.
 */
export async function createProfileWithLogs(opts: {
  userId: string
  profileName?: string
  startDate?: Date
  endDate?: Date
  flowIntensity?: FlowIntensity
  symptomDate?: Date
  symptomCategory?: SymptomCategory
  symptomId?: string
  days?: BangladeshDays
}) {
  const db = getDb()
  const name = opts.profileName ?? 'Primary'
  const profile = await db.profile.create({
    data: {
      userId: opts.userId,
      name,
      relation: 'SELF',
      cycleLength: 28,
      periodLength: 5,
      notificationPref: {
        create: {
          periodAlert: true,
          fertileWindow: true,
          loggingReminder: true,
        },
      },
    },
  })

  const d = opts.days ?? (await bangladeshDays())
  const start = opts.startDate ?? d.startOf(d.daysAgo(10))
  const end = opts.endDate ?? d.startOf(d.daysAgo(6))

  const periodLog = await db.periodLog.create({
    data: {
      profileId: profile.id,
      startDate: start,
      endDate: end,
      flowIntensity: opts.flowIntensity ?? 'MEDIUM',
    },
  })

  const symDate = opts.symptomDate ?? d.startOf(d.daysAgo(5))
  const symptomLog = await db.symptomLog.create({
    data: {
      profileId: profile.id,
      date: symDate,
      category: opts.symptomCategory ?? 'PHYSICAL',
      symptomId: opts.symptomId ?? 'cramps',
      value: 'mild',
    },
  })

  return { profile, periodLog, symptomLog }
}

export type CreateSubscriptionOpts = {
  userId: string
  status: SubscriptionStatus
  bdappsSubscriberId?: string | null
  adminOverride?: boolean
}

/** Upsert a Subscription row and sync `user.subscriptionStatus` (setup only). */
export async function setUserSubscription(opts: CreateSubscriptionOpts): Promise<void> {
  const prisma = e2eDb()
  const existing = await prisma.subscription.findFirst({
    where: { userId: opts.userId },
    orderBy: { createdAt: 'desc' },
  })
  const data: Prisma.SubscriptionUpdateInput = {
    status: opts.status,
    adminOverride: opts.adminOverride ?? false,
    ...(opts.bdappsSubscriberId !== undefined ? { bdappsSubscriberId: opts.bdappsSubscriberId } : {}),
  }
  if (existing) {
    await prisma.subscription.update({ where: { id: existing.id }, data })
  } else {
    await prisma.subscription.create({
      data: {
        userId: opts.userId,
        status: opts.status,
        adminOverride: opts.adminOverride ?? false,
        bdappsSubscriberId: opts.bdappsSubscriberId ?? null,
      },
    })
  }
  await prisma.user.update({ where: { id: opts.userId }, data: { subscriptionStatus: opts.status } })
}
