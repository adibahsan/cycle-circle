/**
 * The demo data's "now": the start of today's Bangladesh day, not the wall clock, so seeded
 * timestamps (and everything the UI derives from them) are the same on every run of the same day.
 * Always in the past, so "now - x" offsets stay valid; use `+ DAY` style offsets for things that must be in the future.
 */
import { bangladeshDayOf, bangladeshDayStart } from '../../support/bangladesh-day.ts'

export const demoNow = (): Date => bangladeshDayStart(bangladeshDayOf(new Date()))
export const demoNowMs = (): number => demoNow().getTime()
