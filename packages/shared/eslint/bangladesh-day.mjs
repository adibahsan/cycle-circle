/**
 * Guardrail against the Bangladesh-day bug class: deriving a calendar day from a CURRENT instant
 * (server/device clock, UTC on prod) instead of the Bangladesh day (UTC+6, no DST).
 *
 * Stored date-only values are UTC midnight, so `stored.toISOString().slice(0, 10)` and
 * `stored.setHours(0, ...)` are correct and deliberately NOT flagged: only a receiver that is a
 * current instant (`new Date()`, `new Date(Date.now())`, `new Date(Date.now() +/- N)`) is.
 *
 * Fix with `bangladeshToday()` / `bangladeshDayOf(instant)` from `@vesta/shared/utils/dhaka-date`.
 * Issue #115 tracks the class.
 *
 * Known gaps in the shapes above (esquery cannot see them):
 *  - Identifier indirection: `const now = new Date(); now.toISOString().slice(0, 10)`, and the
 *    common `const today = new Date(); today.setHours(0, 0, 0, 0)`.
 *  - Day parts read off an identifier, e.g. calendar/page.tsx `now.getMonth()`.
 *  - Event-timestamp UTC bucketing (e.g. sms-service, analytics-service `toISOString().slice(0, 10)`
 *    on a stored createdAt): the receiver is not a current instant.
 *
 * The first two gaps are closed in shared server code by the contract in ADR 0009
 * (`bangladeshDayServerConfig`): services never read the clock at all (no zero-argument `new Date()`
 * or `Date.now()`), so there is no `now` variable to follow. `dateFnsLocalDayConfig` additionally bans
 * date-fns' local-time day functions in shared and server code, which closes the "local midnight of a
 * stored date" variant. Routes, actions, pages and client code (the edge) may read the clock, and the
 * shapes above still apply there. The event-timestamp gap stays open.
 */
const SEE = 'Use bangladeshToday()/bangladeshDayOf() from @vesta/shared/utils/dhaka-date (see #115).'

const DATE = (p) => `[${p}.type="NewExpression"][${p}.callee.name="Date"]`
const DATE_NOW = (p) => `[${p}.callee.object.name="Date"][${p}.callee.property.name="now"]`

/** Attribute-selector variants meaning "the node at path p is a current instant". */
function currentInstant(p) {
  return [
    `${DATE(p)}[${p}.arguments.length=0]`,
    `${DATE(p)}[${p}.arguments.length=1][${p}.arguments.0.type="CallExpression"]${DATE_NOW(`${p}.arguments.0`)}`,
    `${DATE(p)}[${p}.arguments.length=1][${p}.arguments.0.type="BinaryExpression"]${DATE_NOW(`${p}.arguments.0.left`)}`,
  ]
}

const shapes = [
  {
    head: 'CallExpression[callee.property.name=/^(slice|substring|substr)$/][callee.object.callee.property.name="toISOString"]',
    path: 'callee.object.callee.object',
    message: `A current instant's toISOString().slice(...) is the UTC day, not the Bangladesh day. ${SEE}`,
  },
  {
    head: 'MemberExpression[computed=true][property.value=0][object.callee.property.name="split"][object.callee.object.callee.property.name="toISOString"]',
    path: 'object.callee.object.callee.object',
    message: `A current instant's toISOString().split("T")[0] is the UTC day, not the Bangladesh day. ${SEE}`,
  },
  {
    head: 'CallExpression[callee.property.name=/^set(UTC)?Hours$/][arguments.0.value=0]',
    path: 'callee.object',
    message: `setHours(0)/setUTCHours(0) on a current instant finds a day boundary in the wrong timezone. ${SEE}`,
  },
  {
    head: 'CallExpression[callee.property.name=/^get(UTC)?(Date|Day|Month|FullYear)$/]',
    path: 'callee.object',
    message: `Day parts read off a current instant use the server/device clock. ${SEE}`,
  },
]

export const bangladeshDayRestrictedSyntax = [
  ...shapes.flatMap(({ head, path, message }) =>
    currentInstant(path).map((receiver) => ({ selector: `${head}${receiver}`, message })),
  ),
  {
    selector: 'CallExpression[callee.property.name="toDateString"]',
    message: `toDateString() uses the device/server timezone. ${SEE}`,
  },
]

/** Flat-config object; spread into an app's eslint config array. */
export const bangladeshDayConfig = {
  files: ['**/*.{js,jsx,mjs,ts,tsx}'],
  rules: {
    'no-restricted-syntax': ['error', ...bangladeshDayRestrictedSyntax],
  },
}

const CLOCK_MESSAGE =
  'Shared server services never read the clock: take `now: Date` as a parameter and let the edge pass it (docs/adr/0009-services-take-now-only-the-edge-reads-the-clock.md).'

/** Zero-argument `new Date()` and `Date.now()`: reading the clock. */
export const noClockReadSyntax = [
  { selector: 'NewExpression[callee.name="Date"][arguments.length=0]', message: CLOCK_MESSAGE },
  { selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]', message: CLOCK_MESSAGE },
]

/**
 * Shared server code: the Bangladesh-day shapes plus the clock-read ban.
 * Infrastructure that needs wall-clock time for non-calendar purposes (log timestamps, latency,
 * TTL stores, the SMS simulator) is exempt, see `serverClockExemptions`.
 */
export const serverClockExemptions = [
  'src/server/log.ts',
  'src/server/middleware.ts',
  'src/server/adapters/**',
  'src/server/simulator/**',
]

export const bangladeshDayServerConfig = {
  files: ['src/server/**/*.{ts,tsx,mjs,js}'],
  ignores: serverClockExemptions,
  rules: {
    'no-restricted-syntax': ['error', ...bangladeshDayRestrictedSyntax, ...noClockReadSyntax],
  },
}

export const dateFnsLocalDayFunctions = [
  'startOfDay',
  'addDays',
  'subDays',
  'differenceInDays',
  'differenceInCalendarDays',
  'isSameDay',
  'startOfWeek',
  'startOfMonth',
  'endOfMonth',
]

/** `no-restricted-imports` entry banning date-fns local-time day functions (server timezone, DST). */
export const dateFnsLocalDayRule = [
  'error',
  {
    paths: [
      {
        name: 'date-fns',
        importNames: dateFnsLocalDayFunctions,
        message:
          'date-fns day functions work in the process timezone. Use the day helpers in @vesta/shared/utils/dhaka-date (addDaysToDay, daysBetween, ...) on YYYY-MM-DD days.',
      },
    ],
  },
]

/** Pass the globs of shared and server code the ban covers (relative to the package running ESLint). */
export function dateFnsLocalDayConfig(files) {
  return { files, rules: { 'no-restricted-imports': dateFnsLocalDayRule } }
}
