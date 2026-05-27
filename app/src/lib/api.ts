// lib/api.ts — Vesta API Client

import type {
  User,
  UserProfile,
  ProfileRelation,
  PeriodLog,
  FlowIntensity,
  SymptomLog,
  SymptomCategory,
  CyclePhase,
  Prediction,
  FeedbackCategory,
  FeedbackSubmission,
  NotificationPreference,
  Symptom,
} from './types'
import {
  mapApiPeriodLog,
  mapApiPrediction,
  mapApiProfile,
  mapApiSymptomLog,
  mapApiUser,
  mapPartialAuthUser,
  toApiFlowIntensity,
  toApiRelation,
} from './api-mappers'

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

// ── Core request helper ───────────────────────────────────────────────────────

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = data?.error?.message ?? `Request failed with ${res.status}`
    const code = data?.error?.code
    throw new ApiClientError(res.status, msg, code)
  }
  return data as T
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const auth = {
  /** Request an OTP to the given phone number. Returns a referenceNo for verification. */
  requestOtp(phone: string) {
    return request<{ referenceNo: string; message: string }>('/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    })
  },

  /** Verify the OTP. Returns the authenticated user and a session token. */
  verifyOtp(referenceNo: string, otp: string) {
    return request<{
      user: { id: string; phone: string; profileCompleted: boolean }
      token: string
    }>('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ referenceNo, otp }),
    }).then((res) => ({
      ...res,
      user: mapPartialAuthUser(res.user),
    }))
  },

  /** Send a magic-link sign-in email. */
  requestMagicLink(email: string) {
    return request<{ message: string }>('/api/auth/magic-link/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  /** Sign out the current session. */
  logout() {
    return request<{ message: string }>('/api/auth/logout', { method: 'POST' })
  },

  /** Return the currently authenticated user (or throw 401). */
  getStatus() {
    return request<{ user: Record<string, unknown> }>('/api/auth/status').then((res) => ({
      user: mapApiUser(res.user),
    }))
  },

  /**
   * Dev-only: sign in without OTP (requires DEV_MODE=true on server).
   * Uses real DB — not the same as dummy-data mode.
   */
  devLogin(phone: string) {
    return request<{ user: User; token: string }>('/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    })
  },
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export const profiles = {
  /** List all profiles belonging to the current user. */
  list() {
    return request<{ profiles: Record<string, unknown>[] }>('/api/profiles').then((res) =>
      res.profiles.map((raw) => mapApiProfile(raw)),
    )
  },

  /** Fetch a single profile, including its latest prediction if available. */
  get(id: string) {
    return request<{ profile: Record<string, unknown>; prediction?: Record<string, unknown> }>(
      `/api/profiles/${id}`,
    ).then((res) => {
      const profileId = String(res.profile.id)
      const prediction = res.prediction
        ? mapApiPrediction(res.prediction, profileId)
        : undefined
      return {
        ...mapApiProfile(res.profile, res.prediction),
        prediction,
      }
    })
  },

  /** Create a new profile. */
  create(data: {
    name: string
    relation: ProfileRelation
    cycleLength?: number
    periodLength?: number
    lastPeriodStart?: string
    goal?: string
  }) {
    return request<{ profile: Record<string, unknown> }>('/api/profiles', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        relation: toApiRelation(data.relation),
      }),
    }).then((res) => mapApiProfile(res.profile))
  },

  /** Partial-update a profile's mutable fields. */
  update(
    id: string,
    data: {
      name?: string
      cycleLength?: number
      periodLength?: number
      goal?: string
    },
  ) {
    return request<{ profile: Record<string, unknown> }>(`/api/profiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((res) => mapApiProfile(res.profile))
  },

  /** Permanently delete a profile. */
  delete(id: string) {
    return request<{ message: string }>(`/api/profiles/${id}`, { method: 'DELETE' })
  },
}

// ── Tracking ──────────────────────────────────────────────────────────────────

export const tracking = {
  // — Period logs —

  /** List all period logs for a profile. */
  listPeriodLogs(profileId: string) {
    return request<{ logs: Record<string, unknown>[] }>(
      `/api/tracking/period-logs?profileId=${profileId}`,
    ).then((res) => res.logs.map(mapApiPeriodLog))
  },

  /** Record a new period log entry. */
  createPeriodLog(data: {
    profileId: string
    startDate: string
    endDate: string
    flowIntensity: FlowIntensity
  }) {
    return request<{ log: Record<string, unknown> }>('/api/tracking/period-logs', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        flowIntensity: toApiFlowIntensity(data.flowIntensity),
      }),
    }).then((res) => mapApiPeriodLog(res.log))
  },

  /** Update an existing period log. */
  updatePeriodLog(
    id: string,
    data: {
      startDate?: string
      endDate?: string
      flowIntensity?: FlowIntensity
    },
  ) {
    return request<{ log: Record<string, unknown> }>(`/api/tracking/period-logs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...data,
        ...(data.flowIntensity && { flowIntensity: toApiFlowIntensity(data.flowIntensity) }),
      }),
    }).then((res) => mapApiPeriodLog(res.log))
  },

  /** Delete a period log. */
  deletePeriodLog(id: string) {
    return request<{ message: string }>(`/api/tracking/period-logs/${id}`, { method: 'DELETE' })
  },

  // — Symptoms —

  /** List symptom logs for a profile, optionally filtered to a specific date (YYYY-MM-DD). */
  listSymptoms(profileId: string, date?: string) {
    let url = `/api/tracking/symptoms?profileId=${profileId}`
    if (date) url += `&date=${encodeURIComponent(date)}`
    return request<{ logs: Record<string, unknown>[] }>(url).then((res) =>
      res.logs.map(mapApiSymptomLog),
    )
  },

  /** Log a symptom entry. */
  createSymptom(data: {
    profileId: string
    date: string
    category: SymptomCategory
    symptomId: string
    value: string
  }) {
    return request<{ log: Record<string, unknown> }>('/api/tracking/symptoms', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        category: data.category.toUpperCase(),
      }),
    }).then((res) => mapApiSymptomLog(res.log))
  },

  // — Dashboard —

  /** Fetch the home-screen dashboard summary for a profile. */
  getDashboard(profileId: string) {
    return request<{
      currentCycleDay: number
      currentPhase: string
      countdownToNextPeriod: number | null
      lastPeriod: {
        startDate: string
        duration: number
        flowIntensity: string
      } | null
      prediction: Record<string, unknown> | null
    }>(`/api/tracking/dashboard?profileId=${profileId}`).then((res) => ({
      currentCycleDay: res.currentCycleDay,
      currentPhase: res.currentPhase as CyclePhase,
      countdownToNextPeriod: res.countdownToNextPeriod,
      lastPeriod: res.lastPeriod
        ? {
            startDate: res.lastPeriod.startDate,
            duration: res.lastPeriod.duration,
            flowIntensity: String(res.lastPeriod.flowIntensity).toLowerCase() as FlowIntensity,
          }
        : null,
      prediction: res.prediction ? mapApiPrediction(res.prediction, profileId) : null,
    }))
  },

  // — Calendar —

  /**
   * Fetch day-by-day calendar data for a given month.
   * @param month - YYYY-MM format (e.g. "2024-06")
   */
  getCalendar(profileId: string, month: string) {
    return request<{
      days: Array<{
        date: string
        period: boolean
        fertile: boolean
        ovulation: boolean
        predicted: boolean
      }>
    }>(`/api/tracking/calendar?profileId=${profileId}&month=${encodeURIComponent(month)}`).then(
      (res) => res.days,
    )
  },
}

// ── Predictions ───────────────────────────────────────────────────────────────

export const predictions = {
  /** Fetch the latest prediction for a profile, plus a human-readable tier explanation. */
  get(profileId: string) {
    return request<{
      prediction: Prediction | null
      tierExplanation: string
    }>(`/api/predictions?profileId=${profileId}`)
  },
}

// ── Billing ───────────────────────────────────────────────────────────────────

export const billing = {
  /** Initiate a subscription purchase for the given amount (in BDT). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscribe(amount: number) {
    return request<{ subscription: any; transaction: any }>('/api/billing/subscribe', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    })
  },
}

// ── Feedback ──────────────────────────────────────────────────────────────────

export const feedback = {
  /** Submit user feedback or a bug report. */
  submit(data: {
    userId: string
    profileId?: string
    category: FeedbackCategory
    message: string
    rating?: number
  }) {
    return request<FeedbackSubmission>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
}

// ── Notifications ─────────────────────────────────────────────────────────────

export const notifications = {
  /** Fetch notification preferences for a profile. */
  getPreferences(profileId: string) {
    return request<NotificationPreference>(`/api/notifications/preferences?profileId=${profileId}`)
  },

  /** Update notification preferences for a profile. */
  updatePreferences(
    profileId: string,
    data: {
      periodAlert?: boolean
      fertileWindow?: boolean
      loggingReminder?: boolean
    },
  ) {
    return request<NotificationPreference>('/api/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ profileId, ...data }),
    })
  },
}

// ── Symptoms catalogue ────────────────────────────────────────────────────────

export const symptoms = {
  /** Fetch the global symptom catalogue (used to populate symptom pickers). */
  list(category?: SymptomCategory) {
    const url = category
      ? `/api/symptoms?category=${encodeURIComponent(category)}`
      : '/api/symptoms'
    return request<Symptom[]>(url)
  },
}

// ── Health checks ─────────────────────────────────────────────────────────────

export const health = {
  db: () => request<{ status: string; latency: number }>('/api/health/db'),
  redis: () => request<{ status: string; latency: number }>('/api/health/redis'),
  bdapps: () => request<{ status: string; latency: number }>('/api/health/bdapps'),
}
