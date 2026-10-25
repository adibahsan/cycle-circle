import {
  PrismaClient,
  type ArticleStatus,
  type CyclePhase,
  type FlowIntensity,
  type SymptomCategory,
} from '@prisma/client'
import { DATABASE_URL, assertE2eDatabase, SECRETS } from './slot.ts'

let dbClient: PrismaClient | null = null

/**
 * Returns a PrismaClient connected to the slot's E2E database.
 * Never connects to `vesta_dev`.
 */
export function getDb(): PrismaClient {
  if (!dbClient) {
    assertE2eDatabase(DATABASE_URL)
    dbClient = new PrismaClient({ datasourceUrl: DATABASE_URL })
  }
  return dbClient
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

  const start = opts.startDate ?? new Date(Date.now() - 10 * 86400000)
  const end = opts.endDate ?? new Date(Date.now() - 6 * 86400000)

  const periodLog = await db.periodLog.create({
    data: {
      profileId: profile.id,
      startDate: start,
      endDate: end,
      flowIntensity: opts.flowIntensity ?? 'MEDIUM',
    },
  })

  const symDate = opts.symptomDate ?? new Date(Date.now() - 5 * 86400000)
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
