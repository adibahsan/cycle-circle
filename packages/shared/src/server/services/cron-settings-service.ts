import { prisma } from '../db'

/** Slugs of the scheduled cron jobs that can be toggled on/off. */
export type CronSlug = 'daily-reminders' | 'caas-check'

export const CRON_SLUGS: readonly CronSlug[] = ['daily-reminders', 'caas-check']

/**
 * Whether a scheduled cron is currently enabled. An absent row means enabled,
 * so existing deployments keep running with no behavior change.
 */
export async function isCronEnabled(slug: CronSlug): Promise<boolean> {
  const row = await prisma.cronSetting.findUnique({
    where: { slug },
    select: { enabled: true },
  })
  return row?.enabled ?? true
}

/**
 * Current enabled state of every known cron, defaulting any missing slug to
 * enabled. Used by the admin /system page to render the toggles.
 */
export async function getCronSettings(): Promise<Record<CronSlug, boolean>> {
  const rows = await prisma.cronSetting.findMany({
    select: { slug: true, enabled: true },
  })
  const bySlug = new Map(rows.map((r) => [r.slug, r.enabled]))
  return CRON_SLUGS.reduce(
    (acc, slug) => {
      acc[slug] = bySlug.get(slug) ?? true
      return acc
    },
    {} as Record<CronSlug, boolean>,
  )
}

/** Enable or disable a scheduled cron, recording which admin made the change. */
export async function setCronEnabled(
  slug: CronSlug,
  enabled: boolean,
  adminId?: string,
): Promise<void> {
  await prisma.cronSetting.upsert({
    where: { slug },
    create: { slug, enabled, updatedBy: adminId },
    update: { enabled, updatedBy: adminId },
  })
}
