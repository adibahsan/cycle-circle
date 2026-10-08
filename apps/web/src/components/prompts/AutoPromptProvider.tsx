'use client'

/**
 * Thin React layer over the pure arbiter in `@/lib/auto-prompt`.
 *
 * Mount once in the signed-in layout. Anything that wants to auto-open reports a candidate
 * (`useAutoPromptCandidate`); anything that renders an auto-prompt reads `useAutoPrompt().isActive(id)`
 * and calls `close(id)` when it is dismissed. The provider decides, persists last-shown times
 * (localStorage, per account and optional scope such as a profile id) and keeps at most one
 * prompt open per page load. User-opened pop-ups do not go through here, except they must
 * check `locked`.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { decideAutoPrompt, type CandidateState, type Candidates, type PromptId } from '@/lib/auto-prompt'

/** Prefix of every persisted last-shown key (the e2e helper relies on it). */
export const PROMPT_STORAGE_PREFIX = 'vesta_prompt_last:'

export function promptStorageKey(id: PromptId, accountId: string | null, scope?: string | null): string {
  return `${PROMPT_STORAGE_PREFIX}${id}:${accountId ?? 'anon'}${scope ? `:${scope}` : ''}`
}

function readLast(key: string): number | null {
  try {
    const raw = localStorage.getItem(key)
    const n = raw === null ? NaN : Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function writeLast(key: string, ms: number) {
  try {
    localStorage.setItem(key, String(ms))
  } catch {
    /* storage unavailable: prompt may repeat, never blocks */
  }
}

export interface CandidateOptions {
  /** Extra storage scope, e.g. the active profile id for the check-in. */
  scope?: string | null
  /** Skip the cadence rules. */
  ignoreCadence?: boolean
}

interface Entry {
  state: CandidateState
  scope?: string | null
  ignoreCadence?: boolean
}

interface Ctx {
  /** Prompt currently open (trial lock wins), or null. */
  active: PromptId | null
  /** True while the trial lock is up: nothing else may open. */
  locked: boolean
  isActive: (id: PromptId) => boolean
  /** Dismiss an auto-prompt. Does not let another prompt open this page load. */
  close: (id: PromptId) => void
  report: (id: PromptId, entry: Entry | null) => void
  expect: (id: PromptId, expected: boolean) => void
  setAccount: (a: { id: string; createdAt: number } | null) => void
}

const AutoPromptContext = createContext<Ctx | null>(null)

export function AutoPromptProvider({ children }: { children: React.ReactNode }) {
  const [reported, setReported] = useState<Partial<Record<PromptId, Entry>>>({})
  const [expected, setExpected] = useState<Partial<Record<PromptId, boolean>>>({})
  const [account, setAccountState] = useState<{ id: string; createdAt: number } | null>(null)
  const [shown, setShown] = useState<PromptId | null>(null)
  const [active, setActive] = useState<PromptId | null>(null)

  const report = useCallback((id: PromptId, entry: Entry | null) => {
    setReported((prev) => {
      const cur = prev[id]
      if (!entry) {
        if (!cur) return prev
        const next = { ...prev }
        delete next[id]
        return next
      }
      if (cur && cur.state === entry.state && cur.scope === entry.scope && cur.ignoreCadence === entry.ignoreCadence) return prev
      return { ...prev, [id]: entry }
    })
  }, [])

  const expect = useCallback((id: PromptId, value: boolean) => {
    setExpected((prev) => (!!prev[id] === value ? prev : { ...prev, [id]: value }))
  }, [])

  const setAccount = useCallback((a: { id: string; createdAt: number } | null) => {
    setAccountState((prev) => (prev?.id === a?.id && prev?.createdAt === a?.createdAt ? prev : a))
  }, [])

  const candidates: Candidates = useMemo(() => {
    const out: Candidates = {}
    for (const id of Object.keys(expected) as PromptId[]) if (expected[id]) out[id] = { state: 'pending' }
    for (const id of Object.keys(reported) as PromptId[]) out[id] = reported[id]
    return out
  }, [reported, expected])

  const locked = candidates['trial-lock']?.state === 'yes'

  const shownRef = useRef(shown)
  shownRef.current = shown

  useEffect(() => {
    const now = Date.now()
    const lastShown: Partial<Record<PromptId, number | null>> = {}
    for (const id of Object.keys(candidates) as PromptId[]) {
      lastShown[id] = readLast(promptStorageKey(id, account?.id ?? null, candidates[id]?.scope))
    }
    const decision = decideAutoPrompt({
      now,
      candidates,
      lastShown,
      accountCreatedAt: account?.createdAt ?? null,
      shown,
    })
    if (decision.kind !== 'show' || decision.id === 'trial-lock') return
    writeLast(promptStorageKey(decision.id, account?.id ?? null, candidates[decision.id]?.scope), now)
    setShown(decision.id)
    setActive(decision.id)
  }, [candidates, account, shown])

  const close = useCallback((id: PromptId) => {
    setActive((cur) => (cur === id ? null : cur))
  }, [])

  const value = useMemo<Ctx>(() => {
    const act: PromptId | null = locked ? 'trial-lock' : active
    return {
      active: act,
      locked,
      isActive: (id) => act === id,
      close,
      report,
      expect,
      setAccount,
    }
  }, [locked, active, close, report, expect, setAccount])

  return <AutoPromptContext.Provider value={value}>{children}</AutoPromptContext.Provider>
}

export function useAutoPrompt(): Ctx {
  const ctx = useContext(AutoPromptContext)
  if (!ctx) throw new Error('useAutoPrompt must be used inside <AutoPromptProvider>')
  return ctx
}

/** Report whether `id` wants to auto-open. Re-reports on change; withdraws on unmount. */
export function useAutoPromptCandidate(id: PromptId, state: CandidateState, options: CandidateOptions = {}) {
  const { report } = useAutoPrompt()
  const { scope, ignoreCadence } = options
  useEffect(() => {
    report(id, { state, scope, ignoreCadence })
  }, [report, id, state, scope, ignoreCadence])
  useEffect(() => () => report(id, null), [report, id])
}

/** Declare that `id` will report soon (holds back lower-priority prompts). */
export function useAutoPromptExpect(id: PromptId, expected: boolean) {
  const { expect } = useAutoPrompt()
  useEffect(() => {
    expect(id, expected)
    return () => expect(id, false)
  }, [expect, id, expected])
}
