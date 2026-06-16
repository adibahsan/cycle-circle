'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import VestaLogo from '@/components/ui/VestaLogo'

type FormState = 'idle' | 'loading' | 'error'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [state, setState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function login(loginEmail: string, loginPassword: string) {
    setState('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data?.error?.message ?? 'Invalid email or password')
        setState('error')
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setErrorMsg('Network error. Please check your connection.')
      setState('error')
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim() || !password) return
    await login(email, password)
  }

  async function handleDevLogin() {
    await login('admin@vesta.health', 'admin123')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-10%] left-[-5%] w-[40vw] h-[40vw] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-3xl animate-drift" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full bg-[var(--color-secondary)] opacity-[0.06] blur-3xl animate-drift" style={{ animationDelay: '-6s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="glass rounded-2xl p-8 shadow-soft">
          <div className="flex flex-col items-center gap-3 mb-8">
            <VestaLogo size={48} animate />
            <div className="text-center">
              <h1 className="text-2xl font-bold" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Vesta Admin
              </h1>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Sign in to the admin panel
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-[var(--color-text-secondary)]">
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                autoFocus
                required
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vesta.health…"
                disabled={state === 'loading'}
                className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 transition-colors disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-[var(--color-text-secondary)]">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password…"
                  disabled={state === 'loading'}
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 transition-colors disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={state === 'loading'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded transition-colors disabled:opacity-60"
                >
                  {showPassword
                    ? <Eye size={16} aria-hidden="true" />
                    : <EyeOff size={16} aria-hidden="true" />
                  }
                </button>
              </div>
            </div>

            {state === 'error' && (
              <p role="alert" className="text-sm text-[var(--color-primary)] bg-[var(--color-primary)]/8 border border-[var(--color-primary)]/20 rounded-xl px-4 py-3">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={state === 'loading' || !email.trim() || !password}
              className="w-full py-3 rounded-xl gradient-primary text-white text-sm font-semibold shadow-soft hover:opacity-90 active:scale-[0.98] transition-[opacity,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {state === 'loading' ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </button>

            {process.env.NODE_ENV === 'development' && (
              <button
                type="button"
                onClick={handleDevLogin}
                disabled={state === 'loading'}
                className="w-full py-2.5 rounded-xl border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] text-xs font-medium hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Dev — sign in as admin@vesta.health
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
          Vesta Admin &mdash; restricted access only
        </p>
      </div>
    </div>
  )
}
