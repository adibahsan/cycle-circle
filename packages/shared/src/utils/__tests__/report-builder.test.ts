import { describe, it, expect } from 'vitest'
import { buildReport } from '../report-builder'
import type { Metric, OverviewMetrics } from '../../server/services/overview-service'

const m = (value: number | null, previous: number | null, change: number | null): Metric => ({ value, previous, change })

function metrics(over: Partial<OverviewMetrics> = {}): OverviewMetrics {
  return {
    range: { fromDay: '2038-03-01', toDay: '2038-03-07', days: 7 },
    previousRange: { fromDay: '2038-02-22', toDay: '2038-02-28', days: 7 },
    totalUsers: m(1200, 1100, 9.1),
    newSignups: m(100, 125, -20),
    activeUsers: { average: m(41.5, 40, 3.8), latest: m(44, 40, 10), series: [] },
    proSubscribers: m(80, 80, 0),
    churn: {
      byReason: {
        DAILY_CHECK: m(2, 1, 100),
        BDAPPS_UNSUBSCRIBE: m(3, 3, 0),
        ADMIN_REVOKE: m(1, 0, null),
        ACCOUNT_DELETED: m(0, 0, 0),
      },
      churned: m(5, 4, 25),
      rate: m(0.0625, 0.05, 25),
    },
    revenue: { total: m(1234.5, 1000, 23.5), unavailableDays: 0, previousUnavailableDays: 0, series: [] },
    ...over,
  }
}

describe('buildReport', () => {
  it('puts the period in the subject and says weekly or monthly', () => {
    const r = buildReport({ kind: 'weekly', metrics: metrics() })
    expect(r.subject).toBe('Cycle Circle weekly report: 2038-03-01 to 2038-03-07')
    expect(buildReport({ kind: 'monthly', metrics: metrics() }).subject).toContain('monthly report')
  })

  it('shows each headline number with its % change in the text and HTML', () => {
    const { text, html } = buildReport({ kind: 'weekly', metrics: metrics() })
    expect(text).toContain('Total users: 1,200 (+9.1% vs 1,100)')
    expect(text).toContain('New signups: 100 (-20.0% vs 125)')
    expect(text).toContain('Average daily active users: 41.5 (+3.8% vs 40.0)')
    expect(text).toContain('Pro subscribers: 80 (+0.0% vs 80)')
    expect(text).toContain('Churn rate: 6.3% (+25.0% vs 5.0%)')
    expect(text).toContain('Estimated revenue: Tk 1,234.50 (+23.5% vs Tk 1,000.00)')
    expect(html).toContain('Total users')
    expect(html).toContain('+9.1%')
    expect(html).toContain('-20.0%')
  })

  it('labels revenue as estimated and says unavailable instead of zero or NaN', () => {
    const r = buildReport({
      kind: 'weekly',
      metrics: metrics({
        proSubscribers: m(null, null, null),
        churn: { ...metrics().churn, rate: m(null, null, null) },
        revenue: { total: m(null, null, null), unavailableDays: 7, previousUnavailableDays: 7, series: [] },
      }),
    })
    expect(r.text).toContain('Pro subscribers: unavailable')
    expect(r.text).toContain('Churn rate: unavailable')
    expect(r.text).toContain('Estimated revenue: unavailable')
    expect(r.text).not.toMatch(/NaN|null|undefined/)
    expect(r.html).not.toMatch(/NaN|null|undefined/)
  })

  it('shows a change as n/a when there is nothing to compare', () => {
    const r = buildReport({ kind: 'weekly', metrics: metrics({ newSignups: m(5, 0, null) }) })
    expect(r.text).toContain('New signups: 5 (change n/a vs 0)')
  })

  it('links to the admin Overview for the same range, only when an admin URL is known', () => {
    const r = buildReport({ kind: 'weekly', metrics: metrics(), overviewUrl: 'https://admin.example.com/?from=2038-03-01&to=2038-03-07' })
    expect(r.text).toContain('https://admin.example.com/?from=2038-03-01&to=2038-03-07')
    expect(r.html).toContain('href="https://admin.example.com/?from=2038-03-01&amp;to=2038-03-07"')
    expect(buildReport({ kind: 'weekly', metrics: metrics() }).html).not.toContain('href=')
  })

  it('builds a CSV with the BOM, header, one row per number and the churn reasons', () => {
    const { csv, csvFilename } = buildReport({ kind: 'weekly', metrics: metrics() })
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe('Metric,This period,Previous period,Change %')
    expect(lines).toContain('Total users,1200,1100,9.1')
    expect(lines).toContain('Churn rate (fraction),0.0625,0.05,25')
    expect(lines).toContain('Estimated revenue (taka),1234.5,1000,23.5')
    expect(lines).toContain('Churn: Admin revoke (not in churn rate),1,0,')
    expect(csvFilename).toBe('overview_2038-03-01_2038-03-07.csv')
  })

  it('writes a blank cell, not zero, for an unavailable number', () => {
    const { csv } = buildReport({ kind: 'weekly', metrics: metrics({ proSubscribers: m(null, null, null) }) })
    expect(csv.split('\r\n')).toContain('Pro subscribers,,,')
  })

  it('escapes HTML in values it prints', () => {
    const r = buildReport({ kind: 'weekly', metrics: metrics(), overviewUrl: 'https://a.test/?x="><script>' })
    expect(r.html).not.toContain('<script>')
  })
})
