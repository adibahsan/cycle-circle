'use client'

import { useState, useTransition } from 'react'
import { BadgeDollarSign, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { setProPriceAction } from '@/app/actions/system-actions'
import { formatDhaka } from '@vesta/shared/utils/dhaka-date'
import { formatProPrice } from '@vesta/shared/utils/pro-price-format'
import { withProPriceStates } from '@vesta/shared/utils/pro-price-state'
import type { ProPriceEntry, ProPricePeriod } from '@vesta/shared/server/services'

const PERIOD_OPTIONS: { value: ProPricePeriod; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
]

const money = (e: Pick<ProPriceEntry, 'amount' | 'period'>) => formatProPrice(e, 'en')

const inputClass =
  'rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 tabular-nums text-[var(--color-text-primary)] transition-colors focus-visible:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30'

export function ProPriceCard({ initialHistory, today }: { initialHistory: ProPriceEntry[]; today: string }) {
  const [history, setHistory] = useState(initialHistory)
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState<ProPricePeriod>('DAILY')
  const [day, setDay] = useState(today)
  const [pending, start] = useTransition()
  const toast = useToast()

  // One rule for which entry is in effect, scheduled or replaced (shared with the price service).
  const rows = withProPriceStates(history, today)
  const current = rows.find((e) => e.state === 'IN_EFFECT')
  const parsed = Number(amount)
  const canSave = amount.trim() !== '' && Number.isFinite(parsed) && day !== ''

  function save() {
    start(async () => {
      const res = await setProPriceAction({ amount: parsed, period, effectiveFrom: day })
      if (res.ok) {
        setHistory((h) => [...h, res.entry])
        setAmount('')
        toast.success(`Pro price set to ${money(res.entry)} from ${res.entry.effectiveFrom}`)
        if (!res.webCacheRefreshed) toast.error('Saved, but the web app cache did not refresh. Customers may see the old price for a few minutes.')
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
        <BadgeDollarSign size={16} aria-hidden="true" />
        Pro price
      </h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Current: <strong className="tabular-nums text-[var(--color-text-primary)]">{current ? money(current) : 'not set'}</strong>.
        A new price applies from the day you pick, in Bangladesh time. Past prices are kept below.
      </p>

      <div
        role="note"
        className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
      >
        <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          This does not change what BDApps charges. Change the BDApps contract too and keep the two
          the same.
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="pro-price-amount" className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
            Amount (taka)
          </label>
          <input
            id="pro-price-amount"
            name="proPriceAmount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputClass} w-32`}
          />
        </div>
        <Select
          label="Period"
          options={PERIOD_OPTIONS}
          value={period}
          onChange={(v) => setPeriod(v as ProPricePeriod)}
          containerClassName="w-36"
        />
        <div>
          <label htmlFor="pro-price-day" className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
            Takes effect (Bangladesh day)
          </label>
          <input
            id="pro-price-day"
            name="proPriceDay"
            type="date"
            min={today}
            autoComplete="off"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className={inputClass}
          />
        </div>
        <Button size="sm" onClick={save} loading={pending} disabled={!canSave || pending}>
          Set price
        </Button>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Pro price history</caption>
          <thead className="text-xs text-[var(--color-text-muted)]">
            <tr>
              <th scope="col" className="py-1.5 pr-4 font-medium">Price</th>
              <th scope="col" className="py-1.5 pr-4 font-medium">From (Bangladesh day)</th>
              <th scope="col" className="py-1.5 pr-4 font-medium">Set on</th>
              <th scope="col" className="py-1.5 font-medium">Set by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-[var(--color-border)]">
                <td className="py-1.5 pr-4 tabular-nums">
                  {money(e)}
                  {e.state === 'IN_EFFECT' && (
                    <span className="ml-2 rounded-full bg-[var(--color-success-bg)] px-2 py-0.5 text-xs text-[var(--color-success)]">
                      In effect
                    </span>
                  )}
                  {(e.state === 'SCHEDULED' || e.state === 'REPLACED') && (
                    <span className="ml-2 rounded-full bg-[var(--color-bg-muted)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                      {e.state === 'SCHEDULED' ? 'Scheduled' : 'Replaced'}
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-4 tabular-nums">{e.effectiveFrom}</td>
                <td className="py-1.5 pr-4 tabular-nums">
                  {formatDhaka(e.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
                <td className="py-1.5">{e.createdBy ? (e.createdByName ?? 'Admin') : 'Initial setup'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
