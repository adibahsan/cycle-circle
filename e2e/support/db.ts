/**
 * Database client and setup helpers for the slot's E2E database.
 * Use ONLY for test setup states the UI cannot reach in time.
 * Never import `@vesta/shared` prisma directly, which targets vesta_dev.
 * Dates must come from the Bangladesh-day helper (`days` fixture).
 */
import {
  PrismaClient,
  type ArticleStatus,
  type CyclePhase,
  type FlowIntensity,
  type PredictionTier,
  type Prisma,
  type ProfileRelation,
  type SubscriptionStatus,
  type SymptomCategory,
} from '@prisma/client'
import { TEST_DATABASE_URL, DATABASE_URL, assertE2eDatabase, SECRETS, URLS } from './slot.ts'
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
  /** Bengali name set on the category (created or updated). */
  categoryNameBn?: string
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
          data: { name: opts.categoryName, nameBn: opts.categoryNameBn, slug },
        })
      } catch {
        cat = await db.articleCategory.findFirst({ where: { name: opts.categoryName } })
      }
    }
    if (cat && opts.categoryNameBn && cat.nameBn !== opts.categoryNameBn) {
      await db.articleCategory.update({ where: { id: cat.id }, data: { nameBn: opts.categoryNameBn } })
    }
    categoryId = cat?.id
  }

  // Published a minute in the past: a re-upsert stamped "now" races a parallel worker's
  // request (its `now` is taken first), the article reads as scheduled and that list is cached 60 s.
  const article = await db.article.upsert({
    where: { slug: opts.slug },
    update: {
      titleEn: opts.titleEn,
      titleBn: opts.titleBn,
      bodyEn: opts.bodyEn,
      bodyBn: opts.bodyBn,
      status: opts.status ?? 'PUBLISHED',
      cyclePhases: opts.cyclePhases ?? [],
      categoryId,
      publishedAt: (opts.status ?? 'PUBLISHED') === 'PUBLISHED' ? new Date(Date.now() - 60_000) : null,
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
      publishedAt: (opts.status ?? 'PUBLISHED') === 'PUBLISHED' ? new Date(Date.now() - 60_000) : null,
    },
  })
  await revalidateWebArticles()
  return article
}

/**
 * Bust the web app's cached Learn list (`unstable_cache` tag `articles`, 5 min TTL), as the admin
 * app does after a publish. A DB-only write is otherwise invisible to web until the TTL runs out,
 * and on a fresh DB (CI) another spec has usually cached the list first.
 */
export async function revalidateWebArticles(): Promise<void> {
  await revalidateWebTags(['articles'])
}

/** Bust web cache tags the way the admin app does (e.g. `pro-price` after a DB-only price change). */
export async function revalidateWebTags(tags: string[]): Promise<void> {
  const res = await fetch(`${URLS.web}/api/internal/revalidate`, {
    method: 'POST',
    headers: { authorization: `Bearer ${SECRETS.cronSecret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ tags }),
  })
  if (!res.ok) throw new Error(`web revalidate failed: HTTP ${res.status}`)
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
  const start = opts.startDate ?? d.dateOf(d.daysAgo(10))
  const end = opts.endDate ?? d.dateOf(d.daysAgo(6))

  const periodLog = await db.periodLog.create({
    data: {
      profileId: profile.id,
      startDate: start,
      endDate: end,
      flowIntensity: opts.flowIntensity ?? 'MEDIUM',
    },
  })

  const symDate = opts.symptomDate ?? d.dateOf(d.daysAgo(5))
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

/** Find the User record in DB matching a phone number (e.g. 0136XXXXXXX). */
export async function findUserByPhone(phone: string) {
  const digits = phone.replace(/\D/g, '').slice(-10)
  return db.user.findFirst({
    where: { phone: { contains: digits } },
    include: { profiles: true },
  })
}

export interface EnsureProfileOptions {
  name?: string
  relation?: ProfileRelation
  cycleLength?: number
  periodLength?: number
  lastPeriodStart?: Date | null
  goal?: string | null
  dismissTour?: boolean
}

/** Ensure a profile exists for the user and apply any overrides (e.g. goal, lengths). */
export async function ensureUserProfile(phone: string, options: EnsureProfileOptions = {}) {
  const user = await findUserByPhone(phone)
  if (!user) throw new Error(`User with phone ${phone} not found in database`)

  if (options.dismissTour !== false) {
    await db.user.update({
      where: { id: user.id },
      data: { onboardingTourCompletedAt: new Date() },
    })
  }

  const existing = user.profiles[0]
  if (existing) {
    return db.profile.update({
      where: { id: existing.id },
      data: {
        ...(options.name !== undefined && { name: options.name }),
        ...(options.relation !== undefined && { relation: options.relation }),
        ...(options.cycleLength !== undefined && { cycleLength: options.cycleLength }),
        ...(options.periodLength !== undefined && { periodLength: options.periodLength }),
        ...(options.lastPeriodStart !== undefined && { lastPeriodStart: options.lastPeriodStart }),
        ...(options.goal !== undefined && { goal: options.goal }),
      },
    })
  }

  return db.profile.create({
    data: {
      userId: user.id,
      name: options.name ?? 'Test User',
      relation: options.relation ?? 'SELF',
      cycleLength: options.cycleLength ?? 28,
      periodLength: options.periodLength ?? 5,
      lastPeriodStart: options.lastPeriodStart ?? null,
      goal: options.goal ?? 'track',
    },
  })
}

export interface PeriodLogInput {
  startDate: Date
  endDate: Date
  flowIntensity?: FlowIntensity
}

/** Replace period logs for a profile with the provided logs. */
export async function setPeriodLogs(profileId: string, logs: PeriodLogInput[]) {
  await db.periodLog.deleteMany({ where: { profileId } })
  if (logs.length === 0) return []

  const created = []
  for (const log of logs) {
    created.push(
      await db.periodLog.create({
        data: {
          profileId,
          startDate: log.startDate,
          endDate: log.endDate,
          flowIntensity: log.flowIntensity ?? 'MEDIUM',
        },
      }),
    )
  }
  return created
}

export interface SymptomLogInput {
  date: Date
  category: SymptomCategory
  symptomId: string
  value?: string
}

/** Add symptom logs for a profile. */
export async function setSymptomLogs(profileId: string, logs: SymptomLogInput[]) {
  if (logs.length === 0) return []

  const ops = logs.map((log) =>
    db.symptomLog.create({
      data: {
        profileId,
        date: log.date,
        category: log.category,
        symptomId: log.symptomId,
        value: log.value ?? log.symptomId,
      },
    }),
  )
  return db.$transaction(ops)
}

export interface PredictionInput {
  tier: PredictionTier
  nextPeriodStart: Date
  ovulationDay: Date
  fertileStart: Date
  fertileEnd: Date
  confidence: number
}

/** Set or update a prediction record for a profile. */
export async function setPrediction(profileId: string, pred: PredictionInput) {
  return db.prediction.upsert({
    where: { profileId },
    update: pred,
    create: { profileId, ...pred },
  })
}
