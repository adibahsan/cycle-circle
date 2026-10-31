import { ESLint, RuleTester } from 'eslint'
import { builtinRules } from 'eslint/use-at-your-own-risk'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs config
import { bangladeshDayRestrictedSyntax, bangladeshDayConfig, bangladeshDayServerConfig, dateFnsLocalDayConfig, dateFnsLocalDayRule } from './bangladesh-day.mjs'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } })
const options = bangladeshDayRestrictedSyntax

tester.run('no-restricted-syntax (Bangladesh day)', builtinRules.get('no-restricted-syntax')!, {
  valid: [
    // stored date-only values are UTC midnight: formatting them is correct
    { code: 'stored.toISOString().slice(0, 10)', options },
    { code: 'row.date.toISOString().split("T")[0]', options },
    { code: 'new Date("2026-03-01").toISOString().slice(0, 10)', options },
    { code: 'new Date(other.getTime() + 6 * 3_600_000).toISOString().slice(0, 10)', options },
    { code: 'new Date(someMs + 1).toISOString().slice(0, 10)', options },
    { code: 'new Date(y, m, d).toISOString()', options },
    { code: 'new Date().toISOString()', options }, // a timestamp, not a day
    { code: 'stored.setUTCHours(12, 0, 0, 0)', options },
    { code: 'd.setHours(9)', options },
    { code: 'd.setHours(0, 0, 0, 0)', options }, // stored-date normalisation
    { code: 'stored.setUTCHours(0, 0, 0, 0)', options },
    { code: 'new Date(stored).setHours(0, 0, 0, 0)', options },
    { code: 'stored.getUTCDate()', options },
    { code: 'new Date(value).getDate()', options },
    { code: 'bangladeshToday()', options },
    // numbers, and Dates with an explicit timeZone, may use toLocaleString
    { code: 'total.toLocaleString()', options },
    { code: 'data.total.toLocaleString()', options },
    { code: "n.toLocaleString('en-US', { maximumFractionDigits: 2 })", options },
    { code: "n.toLocaleString(undefined, { minimumFractionDigits: 2 })", options },
    { code: "d.toLocaleString('en-US', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' })", options },
    { code: "new Date(x).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })", options },
    { code: "formatDhaka(d, { month: 'short', day: 'numeric' })", options },
  ],
  invalid: [
    { code: 'new Date().toISOString().slice(0, 10)', options, errors: 1 },
    { code: 'new Date().toISOString().substring(0, 10)', options, errors: 1 },
    { code: 'new Date().toISOString().split("T")[0]', options, errors: 1 },
    { code: 'x.toDateString()', options, errors: 1 },
    { code: 'new Date().setHours(0, 0, 0, 0)', options, errors: 1 },
    { code: 'new Date().setUTCHours(0, 0, 0, 0)', options, errors: 1 },
    { code: 'new Date(Date.now()).setHours(0, 0, 0, 0)', options, errors: 1 },
    { code: 'new Date(Date.now()).toISOString().slice(0, 10)', options, errors: 1 },
    { code: 'new Date(Date.now()).toISOString().split("T")[0]', options, errors: 1 },
    { code: 'new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)', options, errors: 1 },
    { code: 'new Date(Date.now() + 4 * 86400000).toISOString().substring(0, 10)', options, errors: 1 },
    { code: 'new Date(Date.now() + 4 * 86400000).toISOString().split("T")[0]', options, errors: 1 },
    { code: 'new Date().getDate()', options, errors: 1 },
    { code: 'new Date().getDay()', options, errors: 1 },
    { code: 'new Date().getUTCMonth()', options, errors: 1 },
    { code: 'new Date().getFullYear()', options, errors: 1 },
    // device/server-timezone locale formatting (#178)
    { code: 'd.toLocaleDateString()', options, errors: 1 },
    { code: "new Date(x).toLocaleDateString(undefined, { month: 'short' })", options, errors: 1 },
    { code: "d.toLocaleDateString('en-US', { timeZone: 'Asia/Dhaka' })", options, errors: 1 },
    { code: 'd.toLocaleTimeString()', options, errors: 1 },
    { code: "d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })", options, errors: 1 },
    { code: "d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })", options, errors: 1 },
    { code: "d.toLocaleString('en-US', { dateStyle: 'medium' })", options, errors: 1 },
    { code: "d.toLocaleString('en-US', { weekday: 'long' })", options, errors: 1 },
    { code: 'new Date(x).toLocaleString()', options, errors: 1 },
    { code: "new Date(x).toLocaleString('en-US')", options, errors: 1 },
  ],
})

// Behaviour through the real flat config: which file locations are covered by which ban.
describe('ADR 0009 contract (flat config)', () => {
  const eslint = new ESLint({
    cwd: process.cwd(),
    overrideConfigFile: true,
    overrideConfig: [
      { languageOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      bangladeshDayConfig,
      bangladeshDayServerConfig,
      dateFnsLocalDayConfig(['src/**/*.{ts,tsx,mjs,js}']),
    ],
  })
  async function messages(code: string, filePath: string) {
    const [result] = await eslint.lintText(code, { filePath })
    return result.messages.map((m) => m.ruleId)
  }

  it('flags a clock read in a shared service', async () => {
    expect(await messages('export const f = () => new Date()', 'src/server/services/x-service.ts')).toEqual(['no-restricted-syntax'])
    expect(await messages('export const f = () => Date.now()', 'src/server/services/x-service.ts')).toEqual(['no-restricted-syntax'])
    expect(await messages('export const f = (now = new Date()) => now', 'src/server/services/x-service.ts')).toEqual(['no-restricted-syntax'])
  })

  it('flags an indirect clock read the day-shape rule cannot follow', async () => {
    const code = 'export const f = () => { const today = new Date(); today.setHours(0, 0, 0, 0); return today }'
    expect(await messages(code, 'src/server/services/x-service.ts')).toContain('no-restricted-syntax')
  })

  it('allows an injected now and arithmetic on a parameter in a service', async () => {
    expect(await messages('export const f = (now) => new Date(now.getTime() + 1)', 'src/server/services/x-service.ts')).toEqual([])
  })

  it('allows a clock read in a route or action (the edge)', async () => {
    expect(await messages('export const f = () => new Date()', 'src/app/api/x/route.ts')).toEqual([])
    expect(await messages('export const f = () => Date.now()', 'src/app/actions/x-actions.ts')).toEqual([])
  })

  it('allows infrastructure that needs wall-clock time (logging, adapters)', async () => {
    expect(await messages('export const f = () => Date.now()', 'src/server/log.ts')).toEqual([])
    expect(await messages('export const f = () => Date.now()', 'src/server/adapters/redis.ts')).toEqual([])
  })

  it('flags date-fns local-time day functions in shared code', async () => {
    for (const fn of ['startOfDay', 'addDays', 'subDays', 'differenceInDays', 'differenceInCalendarDays', 'isSameDay', 'startOfWeek', 'startOfMonth', 'endOfMonth']) {
      expect(await messages(`import { ${fn} } from 'date-fns'\nexport { ${fn} }`, 'src/utils/x.ts')).toEqual(['no-restricted-imports'])
    }
  })

  it('allows date-fns format/parseISO on day strings, and local-day functions outside the covered paths', async () => {
    expect(await messages("import { format, parseISO } from 'date-fns'\nexport { format, parseISO }", 'src/utils/x.ts')).toEqual([])
    expect(await messages("import { addDays } from 'date-fns'\nexport { addDays }", 'components/Grid.tsx')).toEqual([])
  })

  it('exposes the ban as a no-restricted-imports rule with all nine functions', () => {
    expect(dateFnsLocalDayRule[1].paths[0].importNames).toHaveLength(9)
  })
})
