/**
 * Auto-prompt arbiter: pure decision logic (spec #30, "Auto-prompt queue").
 * At most one auto-prompt per page load; the trial lock is absolute.
 * The React side lives in `@/components/prompts/AutoPromptProvider`.
 */

export type PromptId = 'trial-lock' | 'late-alert' | 'tour' | 'check-in' | 'profile'

/** Highest priority first. */
export const PROMPT_PRIORITY: readonly PromptId[] = ['trial-lock', 'late-alert', 'tour', 'check-in', 'profile']

export type CandidateState = 'pending' | 'yes' | 'no'

export interface Candidate {
  /** pending = data not loaded yet; blocks lower-priority prompts from winning. */
  state: CandidateState
  /** Skip the cadence rules (e.g. an explicit tour replay). */
  ignoreCadence?: boolean
  /** Storage scope (e.g. profile id). Used by the React layer only; ignored by the decision. */
  scope?: string | null
}

export type Candidates = Partial<Record<PromptId, Candidate>>

export interface DecideInput {
  now: number
  candidates: Candidates
  /** Epoch ms each prompt was last auto-shown (per account / profile), if ever. */
  lastShown: Partial<Record<PromptId, number | null>>
  /** Epoch ms the account was created; null while unknown. */
  accountCreatedAt: number | null
  /** The non-lock auto-prompt already shown in this page load, if any. */
  shown: PromptId | null
}

export type Decision = { kind: 'show'; id: PromptId } | { kind: 'wait' } | { kind: 'none' }

const HOUR = 3_600_000
export const LOCAL_UTC_OFFSET_MS = 6 * HOUR // Bangladesh, UTC+6
export const PROFILE_MIN_GAP_MS = 3 * 24 * HOUR
export const PROFILE_MIN_ACCOUNT_AGE_MS = 24 * HOUR

/** Local calendar day (UTC+6) as YYYY-MM-DD. */
export function localDayKey(ms: number): string {
  return new Date(ms + LOCAL_UTC_OFFSET_MS).toISOString().slice(0, 10)
}

function cadenceAllows(id: PromptId, c: Candidate, input: DecideInput): boolean {
  if (id === 'trial-lock') return true
  const last = input.lastShown[id] ?? null
  if (id === 'profile') {
    if (input.accountCreatedAt === null) return false
    if (input.now - input.accountCreatedAt < PROFILE_MIN_ACCOUNT_AGE_MS) return false
    return last === null || input.now - last >= PROFILE_MIN_GAP_MS
  }
  if (c.ignoreCadence || last === null) return true
  return localDayKey(last) !== localDayKey(input.now)
}

export function decideAutoPrompt(input: DecideInput): Decision {
  for (const id of PROMPT_PRIORITY) {
    const c = input.candidates[id]
    if (!c || c.state === 'no') continue
    if (id === 'trial-lock') {
      if (c.state === 'yes') return { kind: 'show', id }
      return { kind: 'wait' }
    }
    if (input.shown) continue // one per page load; the lock was handled above
    if (!cadenceAllows(id, c, input)) continue
    return c.state === 'yes' ? { kind: 'show', id } : { kind: 'wait' }
  }
  return { kind: 'none' }
}
