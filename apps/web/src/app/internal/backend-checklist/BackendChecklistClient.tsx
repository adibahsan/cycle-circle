'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type HealthStatus = 'unchecked' | 'checking' | 'ok' | 'error'

interface ServiceHealth {
  status: HealthStatus
  latency?: number
  message?: string
  detail?: Record<string, unknown>
}

interface HealthMap {
  db: ServiceHealth
  redis: ServiceHealth
  bdapps: ServiceHealth
  mailpit: ServiceHealth
}

interface TestResult {
  loading: boolean
  data: unknown
  error?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHECKLIST_STORAGE_KEY = 'vesta-backend-checklist-v1'

const SETUP_STEPS = [
  { id: 'clone', label: 'Clone repository', hint: 'git clone <repo-url>' },
  { id: 'install', label: 'Install dependencies', hint: 'pnpm install' },
  { id: 'env', label: 'Copy .env.example to .env.local', hint: 'cp app/.env.example app/.env.local' },
  { id: 'docker-start', label: 'Start Docker Compose', hint: 'pnpm docker:dev' },
  { id: 'docker-healthy', label: 'Wait for all containers healthy', hint: 'docker compose -f ops/docker/compose.yml ps (all should show "healthy")' },
  { id: 'migrate', label: 'Run database migrations', hint: 'pnpm db:migrate' },
  { id: 'seed', label: 'Seed the database', hint: 'pnpm db:seed' },
  { id: 'backend-test', label: 'Run backend tests', hint: 'pnpm backend:test' },
  { id: 'bdapps-ui', label: 'Open BDApps Simulator UI', hint: 'http://localhost:10001' },
  { id: 'mailpit-ui', label: 'Open Mailpit UI', hint: 'http://localhost:8025' },
  { id: 'dev-server', label: 'Start dev server', hint: 'pnpm dev' },
]

const DOCKER_COMMANDS = [
  { cmd: 'pnpm docker:dev', desc: 'Start all services' },
  { cmd: 'pnpm docker:down', desc: 'Stop all services' },
  { cmd: 'pnpm docker:logs', desc: 'View logs' },
  { cmd: 'pnpm db:migrate', desc: 'Run migrations' },
  { cmd: 'pnpm db:seed', desc: 'Seed database' },
  { cmd: 'pnpm db:studio', desc: 'Open Prisma Studio' },
  { cmd: 'pnpm backend:test', desc: 'Run tests' },
]

const API_SECTIONS = [
  {
    id: 'auth',
    title: 'Auth',
    icon: '🔐',
    endpoints: [
      { method: 'POST', path: '/api/auth/otp/request', desc: 'Request an OTP for a phone number' },
      { method: 'POST', path: '/api/auth/otp/verify', desc: 'Verify OTP and issue JWT session cookie' },
      { method: 'POST', path: '/api/auth/subscription/status', desc: 'Check BDApps subscription status and log in registered subscribers' },
      { method: 'POST', path: '/api/auth/subscription/request', desc: 'Request BDApps subscription registration for phone login' },
      { method: 'POST', path: '/api/auth/magic-link/request', desc: 'Send magic-link email fallback' },
      { method: 'GET', path: '/api/auth/magic-link/callback', desc: 'Consume magic-link token, issue session' },
      { method: 'POST', path: '/api/auth/logout', desc: 'Invalidate session (JWT blacklist)' },
      { method: 'GET', path: '/api/auth/status', desc: 'Returns current authenticated user info' },
    ],
  },
  {
    id: 'profiles',
    title: 'Profiles',
    icon: '👤',
    endpoints: [
      { method: 'GET', path: '/api/profiles', desc: 'List all profiles for the authenticated user' },
      { method: 'POST', path: '/api/profiles', desc: 'Create a new profile (max 6 per account)' },
      { method: 'GET', path: '/api/profiles/[id]', desc: 'Get a single profile by ID' },
      { method: 'PATCH', path: '/api/profiles/[id]', desc: 'Update profile name, relation, or settings' },
      { method: 'DELETE', path: '/api/profiles/[id]', desc: 'Delete a profile and all associated data' },
    ],
  },
  {
    id: 'tracking',
    title: 'Tracking',
    icon: '📅',
    endpoints: [
      { method: 'GET', path: '/api/tracking/period-logs', desc: 'List period log entries for a profile' },
      { method: 'POST', path: '/api/tracking/period-logs', desc: 'Create a new period log entry' },
      { method: 'PATCH', path: '/api/tracking/period-logs/[id]', desc: 'Edit an existing period log' },
      { method: 'DELETE', path: '/api/tracking/period-logs/[id]', desc: 'Delete a period log' },
      { method: 'GET', path: '/api/tracking/symptoms', desc: 'List symptom logs for a profile' },
      { method: 'POST', path: '/api/tracking/symptoms', desc: 'Log symptoms for a date' },
      { method: 'GET', path: '/api/tracking/dashboard', desc: 'Dashboard summary (cycle day, phase, next period)' },
      { method: 'GET', path: '/api/tracking/calendar', desc: 'Calendar data for a month range' },
    ],
  },
  {
    id: 'prediction',
    title: 'Prediction',
    icon: '🔮',
    endpoints: [
      { method: 'GET', path: '/api/predictions', desc: 'Get current cycle predictions for a profile' },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    icon: '💳',
    endpoints: [
      { method: 'POST', path: '/api/billing/subscribe', desc: 'Initiate BDApps CAAS subscription charge' },
      { method: 'POST', path: '/api/cron/caas-check', desc: 'Daily cron — check and renew subscriptions' },
    ],
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    icon: '🔔',
    endpoints: [
      { method: 'POST', path: '/api/webhooks/sms/receive', desc: 'Receive inbound SMS from BDApps' },
      { method: 'POST', path: '/api/webhooks/sms/report', desc: 'Delivery report for outbound SMS' },
      { method: 'POST', path: '/api/webhooks/ussd/receive', desc: 'USSD session message from BDApps' },
      { method: 'POST', path: '/api/webhooks/subscription/notify', desc: 'Subscription event notification' },
    ],
  },
]

const AUTH_LOGIN_OPTIONS = [
  {
    label: 'Phone OTP',
    detail: '/login → /verify-otp',
  },
  {
    label: 'Email magic-link',
    detail: '/email-login fallback',
  },
  {
    label: 'Subscription login',
    detail: '/api/auth/subscription/status + request',
  },
]

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  PATCH: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  PUT: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: HealthStatus }) {
  const base = 'inline-block w-2.5 h-2.5 rounded-full flex-shrink-0'
  if (status === 'ok') return <span className={`${base} bg-emerald-500 shadow-[0_0_6px_#10b981]`} />
  if (status === 'error') return <span className={`${base} bg-red-500 shadow-[0_0_6px_#ef4444]`} />
  if (status === 'checking') return <span className={`${base} bg-amber-400 animate-pulse`} />
  return <span className={`${base} bg-neutral-300 dark:bg-neutral-600`} />
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150
        bg-neutral-100 hover:bg-neutral-200 text-neutral-600
        dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:text-neutral-300
        active:scale-95"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

function JsonViewer({ data, error }: { data: unknown; error?: string }) {
  if (!data && !error) return null

  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700">
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wide">Response</span>
        {error && <span className="text-[10px] text-red-500 font-medium">Error</span>}
        {data != null && !error && <span className="text-[10px] text-emerald-500 font-medium">200 OK</span>}
      </div>
      <pre className={`p-3 text-xs overflow-auto max-h-48 font-mono leading-relaxed
        ${error ? 'text-red-500 bg-red-50 dark:bg-red-950/30' : 'text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900'}`}>
        {error ? error : JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BackendChecklistClient() {
  // Checklist state
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [hydrated, setHydrated] = useState(false)

  // Health state
  const [health, setHealth] = useState<HealthMap>({
    db: { status: 'unchecked' },
    redis: { status: 'unchecked' },
    bdapps: { status: 'unchecked' },
    mailpit: { status: 'unchecked' },
  })

  // Accordion state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  // Quick-test results
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})

  // ── LocalStorage hydration
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY)
      if (raw) setChecked(JSON.parse(raw))
    } catch {
      // ignore parse errors
    }
    setHydrated(true)
  }, [])

  const toggleCheck = useCallback((id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  // ── Progress calculation
  const completedCount = SETUP_STEPS.filter((s) => checked[s.id]).length
  const progressPct = Math.round((completedCount / SETUP_STEPS.length) * 100)

  // ── Health checks
  async function checkHealth(
    service: keyof HealthMap,
    url: string,
  ) {
    setHealth((prev) => ({ ...prev, [service]: { status: 'checking' } }))
    const start = Date.now()
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
      clearTimeout(timeout)
      const data = await res.json().catch(() => ({}))
      const latency = Date.now() - start
      setHealth((prev) => ({
        ...prev,
        [service]: {
          status: res.ok ? 'ok' : 'error',
          latency,
          message: data.message,
          detail: data,
        },
      }))
    } catch (e) {
      const isTimeout = e instanceof Error && e.name === 'AbortError'
      setHealth((prev) => ({
        ...prev,
        [service]: {
          status: 'error',
          latency: Date.now() - start,
          message: isTimeout ? 'Timed out' : (e instanceof Error ? e.message : 'Unreachable'),
        },
      }))
    }
  }

  async function checkAllHealth() {
    await Promise.all([
      checkHealth('db', '/api/health/db'),
      checkHealth('redis', '/api/health/redis'),
      checkHealth('bdapps', '/api/health/bdapps'),
      checkHealth('mailpit', '/api/health/mailpit'),
    ])
  }

  // ── Quick tests
  async function runTest(id: string, fn: () => Promise<Response>) {
    setTestResults((prev) => ({ ...prev, [id]: { loading: true, data: null } }))
    try {
      const res = await fn()
      const data = await res.json().catch(() => null)
      setTestResults((prev) => ({ ...prev, [id]: { loading: false, data } }))
    } catch (e) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { loading: false, data: null, error: e instanceof Error ? e.message : String(e) },
      }))
    }
  }

  const QUICK_TESTS = [
    {
      id: 'otp-request',
      label: 'Test OTP Request',
      icon: '📱',
      color: 'from-pink-500 to-rose-500',
      run: () =>
        fetch('/api/auth/otp/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '8801812345678' }),
        }),
    },
    {
      id: 'auth-status',
      label: 'Test Auth Status',
      icon: '🔑',
      color: 'from-violet-500 to-purple-500',
      run: () => fetch('/api/auth/status'),
    },
    {
      id: 'create-profile',
      label: 'Test Create Profile',
      icon: '👤',
      color: 'from-sky-500 to-blue-500',
      run: () =>
        fetch('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Demo Profile', relation: 'self' }),
        }),
    },
    {
      id: 'period-log',
      label: 'Test Period Log',
      icon: '📅',
      color: 'from-emerald-500 to-teal-500',
      run: () =>
        fetch('/api/tracking/period-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: 'demo-profile-id',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
            flowIntensity: 'medium',
          }),
        }),
    },
  ]

  const SERVICES: Array<{ key: keyof HealthMap; label: string; url: string; icon: string; external?: string }> = [
    { key: 'db', label: 'PostgreSQL', url: '/api/health/db', icon: '🗄️' },
    { key: 'redis', label: 'Redis', url: '/api/health/redis', icon: '⚡' },
    { key: 'bdapps', label: 'BDApps Simulator', url: '/api/health/bdapps', icon: '📡', external: 'http://localhost:10001/mchoice-tap-sdk' },
    { key: 'mailpit', label: 'Mailpit', url: '/api/health/mailpit', icon: '📧', external: 'http://localhost:8025' },
  ]

  // ── Accordion toggle
  const toggleSection = (id: string) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }))

  // ── Render
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg-primary)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-md shadow-pink-200 dark:shadow-pink-900/30">
              <span className="text-white text-sm">V</span>
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Vesta Backend Checklist</h1>
              <p className="text-xs text-[var(--color-text-muted)]">Developer setup guide</p>
            </div>
          </div>

          {/* Progress pill */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <span className="font-semibold text-[var(--color-text-primary)]">{completedCount}/{SETUP_STEPS.length}</span>
              steps done
            </div>
            <div className="w-24 h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-400 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-[var(--color-primary)]">{progressPct}%</span>
          </div>
        </div>

        {/* Full-width progress bar */}
        <div className="h-0.5 bg-[var(--color-border)]">
          <div
            className="h-full bg-gradient-to-r from-pink-500 via-rose-400 to-pink-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Section 1: Infrastructure Status ─────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <SectionHeader icon="🩺" title="Infrastructure Status" />
            <button
              onClick={checkAllHealth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-pink-50 hover:bg-pink-100 text-pink-700
                dark:bg-pink-950/40 dark:hover:bg-pink-900/40 dark:text-pink-300
                border border-pink-200 dark:border-pink-800
                transition-all duration-150 active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Check All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SERVICES.map((svc) => {
              const h = health[svc.key]
              return (
                <div
                  key={svc.key}
                  className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none">{svc.icon}</span>
                      <span className="text-sm font-semibold">{svc.label}</span>
                    </div>
                    <StatusDot status={h.status} />
                  </div>

                  {h.latency !== undefined && (
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {h.status === 'ok' ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {h.latency}ms — Healthy
                        </span>
                      ) : (
                        <span className="text-red-500 truncate block" title={h.message}>
                          {h.message || 'Unreachable'}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => checkHealth(svc.key, svc.url)}
                      disabled={h.status === 'checking'}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium
                        bg-neutral-100 hover:bg-neutral-200 text-neutral-700
                        dark:bg-neutral-700/60 dark:hover:bg-neutral-700 dark:text-neutral-300
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-all duration-150 active:scale-95"
                    >
                      {h.status === 'checking' ? 'Checking…' : 'Check'}
                    </button>
                    {svc.external && (
                      <a
                        href={svc.external}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-700
                          dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/60
                          transition-all duration-150"
                        title="Open in browser"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Section 2: Setup Checklist ────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <SectionHeader icon="✅" title="Setup Steps" />
            {hydrated && completedCount > 0 && (
              <button
                onClick={() => {
                  setChecked({})
                  localStorage.removeItem(CHECKLIST_STORAGE_KEY)
                }}
                className="text-xs text-[var(--color-text-muted)] hover:text-red-500 dark:hover:text-red-400 transition-colors duration-150"
              >
                Reset
              </button>
            )}
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] divide-y divide-[var(--color-border)] overflow-hidden shadow-sm">
            {SETUP_STEPS.map((step, i) => (
              <label
                key={step.id}
                className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer
                  hover:bg-pink-50/50 dark:hover:bg-pink-950/10
                  transition-colors duration-150 group
                  ${checked[step.id] ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={!!checked[step.id]}
                    onChange={() => toggleCheck(step.id)}
                    className="hidden"
                  />
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200
                    ${checked[step.id]
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-[var(--color-border)] group-hover:border-pink-300 dark:group-hover:border-pink-700'}`}
                  >
                    {checked[step.id] && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)] font-mono w-4 text-right flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className={`text-sm font-medium transition-colors duration-200
                      ${checked[step.id] ? 'line-through text-[var(--color-text-muted)]' : ''}`}>
                      {step.label}
                    </span>
                  </div>
                  {step.hint && (
                    <div className="flex items-center gap-1.5 mt-1 ml-6">
                      <code className="text-[11px] text-[var(--color-text-muted)] font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                        {step.hint}
                      </code>
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* ── Section 3: API Reference ──────────────────────────────────────── */}
        <section>
          <SectionHeader icon="📚" title="API Endpoints Reference" className="mb-4" />

          <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                  Login options
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  The auth surface now exposes three entry points without changing the existing OTP and email deep-link routes.
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {AUTH_LOGIN_OPTIONS.map((option) => (
                <div
                  key={option.label}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2"
                >
                  <div className="text-sm font-semibold">{option.label}</div>
                  <div className="mt-1 text-xs text-[var(--color-text-muted)]">{option.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {API_SECTIONS.map((section) => {
              const isOpen = !!openSections[section.id]
              return (
                <div
                  key={section.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden shadow-sm"
                >
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors duration-150"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none">{section.icon}</span>
                      <span className="text-sm font-semibold">{section.title}</span>
                      <span className="text-xs text-[var(--color-text-muted)] bg-neutral-100 dark:bg-neutral-700/60 px-1.5 py-0.5 rounded-full">
                        {section.endpoints.length}
                      </span>
                    </div>
                    <svg
                      className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]/50">
                      {section.endpoints.map((ep, idx) => (
                        <div key={idx} className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors duration-150">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono flex-shrink-0 mt-0.5
                            ${METHOD_COLORS[ep.method] || 'bg-neutral-100 text-neutral-700'}`}>
                            {ep.method}
                          </span>
                          <div className="flex-1 min-w-0">
                            <code className="text-xs font-mono text-[var(--color-text-primary)] block">{ep.path}</code>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{ep.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Section 4: Quick Test Panel ───────────────────────────────────── */}
        <section>
          <SectionHeader icon="⚡" title="Quick Test Panel" className="mb-4" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {QUICK_TESTS.map((test) => {
              const result = testResults[test.id]
              return (
                <div
                  key={test.id}
                  className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-sm"
                >
                  <button
                    onClick={() => runTest(test.id, test.run)}
                    disabled={result?.loading}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg
                      text-sm font-medium text-white
                      bg-gradient-to-r ${test.color}
                      hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed
                      shadow-md transition-all duration-150 active:scale-[0.98]`}
                  >
                    <span>{test.icon}</span>
                    {result?.loading ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Running…
                      </span>
                    ) : test.label}
                  </button>
                  <JsonViewer data={result?.data} error={result?.error} />
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Section 5: Docker Commands ────────────────────────────────────── */}
        <section>
          <SectionHeader icon="🐳" title="Docker Commands" className="mb-4" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DOCKER_COMMANDS.map((cmd) => (
              <div
                key={cmd.cmd}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex-1 min-w-0">
                  <code className="text-xs font-mono font-semibold text-[var(--color-primary)] block truncate">{cmd.cmd}</code>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{cmd.desc}</p>
                </div>
                <CopyButton text={cmd.cmd} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="pt-4 pb-8 text-center text-xs text-[var(--color-text-muted)]">
          Vesta Backend Checklist — developer tool only
          <span className="mx-2">·</span>
          <a href="/" className="hover:text-[var(--color-primary)] transition-colors duration-150">
            Back to app
          </a>
        </footer>
      </div>
    </div>
  )
}

// ── Shared section header ──────────────────────────────────────────────────────
function SectionHeader({
  icon,
  title,
  className = '',
}: {
  icon: string
  title: string
  className?: string
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xl leading-none">{icon}</span>
      <h2 className="text-base font-bold">{title}</h2>
    </div>
  )
}
