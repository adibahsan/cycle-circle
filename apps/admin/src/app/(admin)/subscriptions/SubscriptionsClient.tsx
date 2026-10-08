'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { CreditCard, Mail, Smartphone, ShieldCheck, AlertTriangle } from 'lucide-react'
import { FilterBar } from '@/components/ui/FilterBar'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { setUserSubscriptionStatus } from '@/app/actions/user-actions'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { ChartPanel } from '@/components/charts/ChartPanelLazy'
import { DateRangeControl } from '@/components/charts/DateRangeControl'
import { CHART_VAR } from '@/lib/chart-palette'

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirror the Prisma include shape from getSubscriptions
// ─────────────────────────────────────────────────────────────────────────────

interface CaasTransaction {
  id: string
  amount: number
  status: string
  createdAt: Date
}

interface SubscriptionRow {
  id: string
  userId: string
  status: string
  amount: number | null
  consecutiveFailures: number
  gracePeriodEndsAt: Date | null
  adminOverride: boolean
  adminOverrideBy: string | null
  adminOverrideAt: Date | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    fullName: string | null
    phone: string | null
    email: string | null
  }
  caasTransactions: CaasTransaction[]
}

interface SubscriptionsClientProps {
  data: {
    subscriptions: SubscriptionRow[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  trend: { date: string; count: number }[]
  statusBreakdown: { status: string; count: number }[]
  caasDistribution: { result: string; count: number }[]
  range: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'PRO', label: 'PRO' },
  { value: 'FREE', label: 'FREE' },
  { value: 'LAPSED', label: 'Lapsed' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(d: Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatAmount(cents: number | null | undefined) {
  if (cents == null) return '—'
  // BDApps amounts are in paisa (1/100 BDT)
  return `৳${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)}`
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'PRO') return <Badge variant="success" size="sm">PRO</Badge>
  if (status === 'LAPSED') return <Badge variant="danger" size="sm">Lapsed</Badge>
  return <Badge variant="neutral" size="sm">Free</Badge>
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions cell — extracted so it can use hooks via the parent
// ─────────────────────────────────────────────────────────────────────────────

interface ActionsCellProps {
  row: SubscriptionRow
  onGrant: (row: SubscriptionRow) => void
  onRevoke: (row: SubscriptionRow) => void
  onSetFree: (row: SubscriptionRow) => void
}

function ActionsCell({ row, onGrant, onRevoke, onSetFree }: ActionsCellProps) {
  const isPro = row.status === 'PRO'
  const isFree = row.status === 'FREE'
  return (
    <div className="flex items-center gap-1.5">
      {!isPro && (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onGrant(row) }}
        >
          Grant Pro
        </Button>
      )}
      {!isFree && (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onSetFree(row) }}
        >
          Set Free
        </Button>
      )}
      {isPro && (
        <Button
          variant="danger"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onRevoke(row) }}
        >
          Revoke
        </Button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main client component
// ─────────────────────────────────────────────────────────────────────────────

export function SubscriptionsClient({ data, trend, statusBreakdown, caasDistribution, range }: SubscriptionsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [actionPending, startActionTransition] = useTransition()

  // Modal state
  const [grantTarget, setGrantTarget] = useState<SubscriptionRow | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<SubscriptionRow | null>(null)
  const [freeTarget, setFreeTarget] = useState<SubscriptionRow | null>(null)

  const currentStatus = searchParams.get('status') ?? 'all'
  const currentPage = data.page
  const currentPageSize = data.pageSize

  // ── URL helpers ──────────────────────────────────────────────────────────

  const updateParams = useCallback(
    (updates: Record<string, string | number>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([k, v]) => {
        if (v === '' || v === undefined) {
          params.delete(k)
        } else {
          params.set(k, String(v))
        }
      })
      if (!('page' in updates)) params.set('page', '1')
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [router, pathname, searchParams]
  )

  function handleStatusChange(value: string) {
    updateParams({ status: value })
  }

  function handlePageChange(page: number) {
    updateParams({ page })
  }

  function handlePageSizeChange(pageSize: number) {
    updateParams({ pageSize, page: 1 })
  }

  // ── Server action handlers ────────────────────────────────────────────────

  function handleConfirmGrant() {
    if (!grantTarget) return
    const userId = grantTarget.user.id
    setGrantTarget(null)
    startActionTransition(async () => {
      await setUserSubscriptionStatus(userId, 'PRO')
      router.refresh()
    })
  }

  function handleConfirmRevoke() {
    if (!revokeTarget) return
    const userId = revokeTarget.user.id
    setRevokeTarget(null)
    startActionTransition(async () => {
      await setUserSubscriptionStatus(userId, 'LAPSED')
      router.refresh()
    })
  }

  function handleConfirmFree() {
    if (!freeTarget) return
    const userId = freeTarget.user.id
    setFreeTarget(null)
    startActionTransition(async () => {
      await setUserSubscriptionStatus(userId, 'FREE')
      router.refresh()
    })
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns: Column<SubscriptionRow>[] = [
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <div className="space-y-0.5 min-w-[140px]">
          <p className="font-medium text-[var(--color-text-primary)] truncate max-w-[180px]">
            {row.user.fullName ?? '—'}
          </p>
          {row.user.email && (
            <div className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
              <Mail size={11} aria-hidden="true" className="shrink-0" />
              <span className="truncate max-w-[160px]">{row.user.email}</span>
            </div>
          )}
          {row.user.phone && (
            <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
              <Smartphone size={11} aria-hidden="true" className="shrink-0" />
              <span>{row.user.phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => (
        <span className="text-sm tabular-nums text-[var(--color-text-secondary)] font-mono">
          {formatAmount(row.amount)}
        </span>
      ),
    },
    {
      key: 'consecutiveFailures',
      header: 'Failures',
      render: (row) => {
        const count = row.consecutiveFailures
        if (count === 0) {
          return <span className="text-sm tabular-nums text-[var(--color-text-muted)]">0</span>
        }
        return (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle size={13} aria-hidden="true" />
            {count}
          </span>
        )
      },
    },
    {
      key: 'gracePeriodEndsAt',
      header: 'Grace Period End',
      sortable: true,
      render: (row) => {
        if (!row.gracePeriodEndsAt) {
          return <span className="text-sm text-[var(--color-text-muted)]">—</span>
        }
        const isExpired = new Date(row.gracePeriodEndsAt) < new Date()
        return (
          <span
            className={
              isExpired
                ? 'text-sm text-red-600 dark:text-red-400'
                : 'text-sm text-[var(--color-text-secondary)]'
            }
          >
            {formatDate(row.gracePeriodEndsAt)}
          </span>
        )
      },
    },
    {
      key: 'adminOverride',
      header: 'Admin Override',
      render: (row) => {
        if (!row.adminOverride) {
          return <span className="text-sm text-[var(--color-text-muted)]">—</span>
        }
        return (
          <span className="inline-flex items-center gap-1">
            <Badge variant="info" size="sm">
              <ShieldCheck size={11} aria-hidden="true" className="mr-1" />
              Override
            </Badge>
          </span>
        )
      },
    },
    {
      key: 'lastTransaction',
      header: 'Last Transaction',
      sortable: false,
      render: (row) => {
        const tx = row.caasTransactions[0]
        if (!tx) return <span className="text-sm text-[var(--color-text-muted)]">—</span>
        return (
          <div className="space-y-0.5">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {formatDate(tx.createdAt)}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">{tx.status}</p>
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      width: '100px',
      render: (row) => (
        <ActionsCell
          row={row}
          onGrant={setGrantTarget}
          onRevoke={setRevokeTarget}
          onSetFree={setFreeTarget}
        />
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-1 flex-col gap-6 page-enter">
        <AdminPageHeader
          title="Subscriptions"
          description={`${data.total.toLocaleString()} total subscriptions`}
          tags={[adminCacheTags.subscriptions]}
          actions={
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-[var(--color-border)] glass px-4 py-2.5">
              <CreditCard size={16} aria-hidden="true" className="text-[var(--color-primary)]" />
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                BDApps CAAS
              </span>
            </div>
          }
        />

        {/* Charts — date-range controlled trend + CAAS, plus status breakdown */}
        <section aria-label="Subscription charts">
          {/* Date range control — shared by trend and CAAS panels */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              Overview
            </h2>
            <DateRangeControl paramKey="range" />
          </div>

          {/* Three-panel responsive grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Subscriptions over time — area chart */}
            <div className="lg:col-span-2">
              <ChartPanel
                title="New Subscriptions"
                data={trend.map((d) => ({ date: d.date.slice(5), count: d.count }))}
                xKey="date"
                series={[{ key: 'count', label: 'Subscriptions', color: CHART_VAR.primary }]}
                kinds={['area', 'bar', 'line']}
                defaultKind="area"
                height={240}
                emptyLabel="No subscription activity in this period."
              />
            </div>

            {/* Subscription status breakdown — pie */}
            <ChartPanel
              title="Status Breakdown"
              data={statusBreakdown.map((d) => ({ status: d.status, count: d.count }))}
              xKey="status"
              series={[{ key: 'count', label: 'Count' }]}
              kinds={['pie', 'bar']}
              defaultKind="pie"
              height={240}
              emptyLabel="No subscription data."
            />

            {/* CAAS result distribution — bar */}
            <div className="lg:col-span-3">
              <ChartPanel
                title={`CAAS Result Distribution — last ${range}`}
                data={caasDistribution.map((d) => ({ result: d.result, count: d.count }))}
                xKey="result"
                series={[{ key: 'count', label: 'Transactions', color: CHART_VAR.secondary }]}
                kinds={['bar', 'pie']}
                defaultKind="bar"
                height={220}
                emptyLabel="No CAAS transactions in this period."
              />
            </div>
          </div>
        </section>

        {/* Filters — no search field, just status filter */}
        <FilterBar
          searchValue=""
          onSearchChange={() => {}}
          showSearch={false}
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: STATUS_OPTIONS,
              value: currentStatus,
              onChange: handleStatusChange,
            },
          ]}
        />

        {/* Table */}
        <DataTable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={data.subscriptions as unknown as Record<string, unknown>[]}
          emptyMessage="No subscriptions match your filters."
          keyExtractor={(row) => row['id'] as string}
          loading={actionPending}
        />

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={data.totalPages}
          pageSize={currentPageSize}
          total={data.total}
          itemLabel="subscription"
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {/* Grant Pro confirm modal */}
      <ConfirmModal
        open={grantTarget !== null}
        onClose={() => setGrantTarget(null)}
        onConfirm={handleConfirmGrant}
        title="Grant Pro Access"
        message={`Grant Pro access to ${grantTarget?.user.fullName ?? 'this user'}? This will override their current subscription status.`}
        confirmLabel="Grant Pro"
        variant="warning"
        loading={actionPending}
      />

      {/* Revoke Pro confirm modal */}
      <ConfirmModal
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleConfirmRevoke}
        title="Revoke Pro Access"
        message={`Revoke Pro access from ${revokeTarget?.user.fullName ?? 'this user'}? Their subscription will be set to Lapsed.`}
        confirmLabel="Revoke Pro"
        variant="danger"
        loading={actionPending}
      />

      {/* Set Free confirm modal */}
      <ConfirmModal
        open={freeTarget !== null}
        onClose={() => setFreeTarget(null)}
        onConfirm={handleConfirmFree}
        title="Set Subscription to Free"
        message={`Set ${freeTarget?.user.fullName ?? 'this user'}'s subscription to Free? This will remove any active Pro or Lapsed status.`}
        confirmLabel="Set Free"
        variant="warning"
        loading={actionPending}
      />
    </>
  )
}
