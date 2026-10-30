import { describe, it } from 'node:test'
import { RuleTester } from 'eslint'
import rule from './test-fail-links-issue.mjs'

RuleTester.describe = describe
RuleTester.it = it

const URL_OK = 'https://github.com/adibahsan/cycle-circle/issues/160'
const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: 2023, sourceType: 'module' } })

ruleTester.run('test-fail-links-issue', rule, {
  valid: [
    `test.fail(true, '${URL_OK}')`,
    `test.fail(days.serverDayLags, '${URL_OK} (guarded)')`,
    `test.fixme(true, \`see ${URL_OK}\`)`,
    `test.fail('title ${URL_OK}', async () => {})`,
    `test.fail(cond, 'reason ' + '${URL_OK}')`,
    `test.skip(true, 'phone only')`,
    `foo.fail(true, 'not playwright')`,
    `test.describe.fixme('suite', () => {})`.replace("'suite'", `'${URL_OK}'`),
  ],
  invalid: [
    { code: `test.fail(true, 'issue #137')`, errors: [{ messageId: 'missingLink' }] },
    { code: `test.fail(true, 'https://github.com/other/repo/issues/1')`, errors: [{ messageId: 'missingLink' }] },
    { code: `test.fail(true, 'https://github.com/adibahsan/cycle-circle/issues/abc')`, errors: [{ messageId: 'missingLink' }] },
    { code: `test.fixme(true)`, errors: [{ messageId: 'missingLink' }] },
    { code: `test.fail()`, errors: [{ messageId: 'missingLink' }] },
    { code: `test.fail(cond, reason)`, errors: [{ messageId: 'missingLink' }] },
    { code: `test.describe.fixme('suite', () => {})`, errors: [{ messageId: 'missingLink' }] },
  ],
})
