'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { requireAuth, getAuthUser } from '@vesta/shared/server/auth'
import { upsertNotificationPrefs, listProfiles, listPeriodLogs, getSymptomLogs, setProfileReminderOptOut } from '@vesta/shared/server/services'

const updatePrefsSchema = z.object({
  profileId: z.string().min(1),
  periodAlert: z.boolean().optional(),
  fertileWindow: z.boolean().optional(),
  loggingReminder: z.boolean().optional(),
})

export async function updateNotificationPrefs(input: z.infer<typeof updatePrefsSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = updatePrefsSchema.parse(input)

  const updated = await upsertNotificationPrefs(data.profileId, user.id, {
    periodAlert: data.periodAlert,
    fertileWindow: data.fertileWindow,
    loggingReminder: data.loggingReminder,
  })

  revalidateTag(`notifications:${data.profileId}`, { expire: 0 })
  return updated
}

export async function updateProfileReminderOptOut(optOut: boolean): Promise<boolean> {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const result = await setProfileReminderOptOut(user.id, optOut)
  revalidateTag(`user:${user.id}`, { expire: 0 })
  return result
}

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function exportUserDataCsv(): Promise<{ csv: string; filename: string }> {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)

  const profiles = await listProfiles(user.id)

  const periodRows: string[] = []
  const symptomRows: string[] = []

  periodRows.push('Profile,Relation,Start Date,End Date,Flow Intensity')
  symptomRows.push('Profile,Relation,Date,Category,Symptom ID')

  for (const profile of profiles) {
    const [periodLogs, symptomLogs] = await Promise.all([
      listPeriodLogs(profile.id, user.id),
      getSymptomLogs(profile.id, user.id),
    ])

    for (const log of periodLogs) {
      periodRows.push(
        [
          escapeCsvField(profile.name),
          escapeCsvField(profile.relation),
          escapeCsvField(log.startDate.toISOString().slice(0, 10)),
          escapeCsvField(log.endDate.toISOString().slice(0, 10)),
          escapeCsvField(log.flowIntensity),
        ].join(','),
      )
    }

    for (const log of symptomLogs) {
      symptomRows.push(
        [
          escapeCsvField(profile.name),
          escapeCsvField(profile.relation),
          escapeCsvField(new Date(log.date).toISOString().slice(0, 10)),
          escapeCsvField(log.category),
          escapeCsvField(log.symptomId),
        ].join(','),
      )
    }
  }

  const sections = [
    '=== PERIOD LOGS ===',
    ...periodRows,
    '',
    '=== SYMPTOM LOGS ===',
    ...symptomRows,
  ]

  const csv = sections.join('\n')
  const filename = `vesta-export-${new Date().toISOString().slice(0, 10)}.csv`

  return { csv, filename }
}

export async function exportUserDataRows(): Promise<{
  periodLogs: string[][]
  symptomLogs: string[][]
  filename: string
}> {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const profiles = await listProfiles(user.id)

  const periodLogs: string[][] = [['Profile', 'Relation', 'Start Date', 'End Date', 'Flow Intensity']]
  const symptomLogs: string[][] = [['Profile', 'Relation', 'Date', 'Category', 'Symptom ID']]

  for (const profile of profiles) {
    const [periodLogData, symptomLogData] = await Promise.all([
      listPeriodLogs(profile.id, user.id),
      getSymptomLogs(profile.id, user.id),
    ])

    for (const log of periodLogData) {
      periodLogs.push([
        profile.name,
        profile.relation,
        log.startDate.toISOString().slice(0, 10),
        log.endDate.toISOString().slice(0, 10),
        log.flowIntensity,
      ])
    }

    for (const log of symptomLogData) {
      symptomLogs.push([
        profile.name,
        profile.relation,
        new Date(log.date).toISOString().slice(0, 10),
        log.category,
        log.symptomId,
      ])
    }
  }

  return {
    periodLogs,
    symptomLogs,
    filename: `vesta-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
  }
}
