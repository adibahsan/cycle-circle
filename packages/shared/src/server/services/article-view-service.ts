import { prisma } from '../db'
import { bangladeshDayOf, dayToStoredDate } from '../../utils/dhaka-date'

/**
 * Record that `userId` read `articleId` on the Bangladesh day containing `now`.
 * Idempotent (one row per article, user and day). Only published articles count, and suspended or
 * deleted users never do. The caller decides whether the reader may show the article.
 */
export async function recordArticleView(articleId: string, userId: string, now: Date): Promise<void> {
  const [article, user] = await Promise.all([
    prisma.article.findFirst({ where: { id: articleId, status: 'PUBLISHED' }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { suspendedAt: true, deletedAt: true } }),
  ])
  if (!article || !user || user.suspendedAt || user.deletedAt) return

  await prisma.articleView.createMany({
    data: [{ articleId, userId, day: dayToStoredDate(bangladeshDayOf(now)) }],
    skipDuplicates: true,
  })
}
