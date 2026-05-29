'use client'

import { useState } from 'react'
import VestaLogo from '@/components/ui/VestaLogo'

type FormState = 'idle' | 'loading' | 'success' | 'error'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) return
    setState('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/auth/magic-link/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data?.error?.message ?? 'Something went wrong. Please try again.')
        setState('error')
        return
      }

      setState('success')
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.')
      setState('error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] relative overflow-hidden">
      {/* Background gradient blobs */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-[-10%] left-[-5%] w-[40vw] h-[40vw] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-3xl animate-drift" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full bg-[var(--color-secondary)] opacity-[0.06] blur-3xl animate-drift" style={{ animationDelay: '-6s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Glass card */}
        <div className="glass rounded-2xl p-8 shadow-soft">
          {/* Branding */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <VestaLogo size={48} animate />
            <div className="text-center">
              <h1 className="text-2xl font-bold gradient-primary bg-clip-text text-transparent">
                Vesta Admin
              </h1>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Secure admin access
              </p>
            </div>
          </div>

          {state === 'success' ? (
            /* Success state */
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center mx-auto shadow-glow">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-7 h-7"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">Check your email</p>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  A login link has been sent to <span className="font-medium text-[var(--color-text-secondary)]">{email}</span>.
                  It expires in 15&nbsp;minutes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setState('idle'); setEmail('') }}
                className="text-sm text-[var(--color-primary)] hover:underline underline-offset-4 font-medium"
              >
                Use a different email
              </button>
            </div>
          ) : (
            /* Login form */
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-[var(--color-text-secondary)]"
                >
                  Admin email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@vesta.health"
                  disabled={state === 'loading'}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-colors disabled:opacity-60"
                />
              </div>

              {state === 'error' && (
                <p className="text-sm text-[var(--color-primary)] bg-[var(--color-primary)]/8 border border-[var(--color-primary)]/20 rounded-xl px-4 py-3">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={state === 'loading' || !email.trim()}
                className="w-full py-3 rounded-xl gradient-primary text-white text-sm font-semibold shadow-soft hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {state === 'loading' ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Sending link…
                  </span>
                ) : (
                  'Send login link'
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
          Vesta Admin &mdash; restricted access only
        </p>
      </div>
    </div>
  )
}
