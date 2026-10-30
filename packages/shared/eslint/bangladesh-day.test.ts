import { RuleTester } from 'eslint'
import { builtinRules } from 'eslint/use-at-your-own-risk'
import { describe, it } from 'vitest'
// @ts-expect-error plain .mjs config
import { bangladeshDayRestrictedSyntax } from './bangladesh-day.mjs'

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
  ],
})
