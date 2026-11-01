// The calendar's today marker is the Server Component's Bangladesh day (#220), never the process
// or device clock. Prod and CI servers run at TZ=UTC, where the process day lags the Bangladesh
// day from 00:00 to 06:00 Asia/Dhaka, so this file pins TZ=UTC whatever the developer's machine uses.
process.env.TZ = 'UTC'

import { describe, it, expect, vi, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }))

import { CalendarClient } from '@/app/(main)/calendar/CalendarClient'
import { SymptomsClient } from '@/app/(main)/symptoms/SymptomsClient'

afterEach(() => {
  vi.useRealTimers()
})

function todayMarkers(html: string): string[] {
  return [...html.matchAll(/<button[^>]*aria-current="date"[^>]*>/g)].map((m) => /data-date="([^"]+)"/.exec(m[0])?.[1] ?? '?')
}

function render(today: string, month: string): string {
  return renderToStaticMarkup(
    createElement(CalendarClient, {
      profiles: [{ id: 'p1', name: 'A', cycleLength: 28, periodLength: 5 }],
      activeProfileId: 'p1',
      month,
      today,
      days: [],
      windowDays: [],
      symptomLogs: [],
      periodLogs: [],
    } as unknown as Parameters<typeof CalendarClient>[0]),
  )
}

function renderSymptoms(today: string, date: string): string {
  return renderToStaticMarkup(
    createElement(SymptomsClient, {
      profiles: [{ id: 'p1', name: 'A', cycleLength: 28, periodLength: 5 }],
      activeProfileId: 'p1',
      date,
      today,
      symptomLogs: [],
      goal: null,
    } as unknown as Parameters<typeof SymptomsClient>[0]),
  )
}

describe('calendar marks the Bangladesh day as today (#220)', () => {
  for (const [label, instant, today] of [
    ['00:30 Bangladesh (18:30 UTC the day before)', '2026-10-25T18:30:00.000Z', '2026-10-26'],
    ['05:59 Bangladesh (23:59 UTC the day before)', '2026-10-25T23:59:00.000Z', '2026-10-26'],
    ['first of the month at 01:30 Bangladesh', '2026-10-31T19:30:00.000Z', '2026-11-01'],
    ['midday Bangladesh', '2026-10-26T06:00:00.000Z', '2026-10-26'],
  ] as const) {
    it(label, () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(instant))
      expect(todayMarkers(render(today, today.slice(0, 7)))).toEqual([today])
    })
  }
})

describe('symptoms grid marks the Bangladesh day as today (#220)', () => {
  it('at 01:30 Bangladesh on the first of the month', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-31T19:30:00.000Z'))
    expect(todayMarkers(renderSymptoms('2026-11-01', '2026-11-01'))).toEqual(['2026-11-01'])
  })

  it('an opened past ?date= keeps today on the Bangladesh day', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-25T18:30:00.000Z'))
    expect(todayMarkers(renderSymptoms('2026-10-26', '2026-10-20'))).toEqual(['2026-10-26'])
  })
})
