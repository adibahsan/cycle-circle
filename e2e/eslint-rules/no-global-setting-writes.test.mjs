import { describe, it } from 'node:test'
import { RuleTester } from 'eslint'
import rule from './no-global-setting-writes.mjs'

RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: 2023, sourceType: 'module' } })
const allow = [{ allow: ['tests/admin/system.spec.ts'] }]
const filename = '/repo/e2e/tests/web/other.spec.ts'

ruleTester.run('no-global-setting-writes', rule, {
  valid: [
    { code: `e2eDb().systemSetting.findUnique({ where: { key } })`, filename, options: allow },
    { code: `db.cronSetting.findMany()`, filename, options: allow },
    { code: `e2eDb().user.deleteMany({})`, filename, options: allow },
    { code: `e2eDb().systemSetting.upsert({})`, filename: '/repo/e2e/tests/admin/system.spec.ts', options: allow },
    { code: `db.cronSetting.update({})`, filename: 'C:\\repo\\e2e\\tests\\admin\\system.spec.ts', options: allow },
  ],
  invalid: [
    { code: `e2eDb().systemSetting.upsert({})`, filename, options: allow, errors: [{ messageId: 'notAllowed' }] },
    { code: `db.systemSetting.deleteMany({})`, filename, options: allow, errors: [{ messageId: 'notAllowed' }] },
    { code: `e2eDb().cronSetting.update({})`, filename, options: allow, errors: [{ messageId: 'notAllowed' }] },
    { code: `tx.cronSetting.createMany({})`, filename, errors: [{ messageId: 'notAllowed' }] },
    { code: `fixtures.db.systemSetting.create({})`, filename, options: allow, errors: [{ messageId: 'notAllowed' }] },
    { code: `db.cronSetting.delete({})`, filename, options: allow, errors: [{ messageId: 'notAllowed' }] },
    { code: `db.systemSetting.updateMany({})`, filename: '/repo/e2e/tests/admin/system.spec.tsx', options: allow, errors: [{ messageId: 'notAllowed' }] },
  ],
})
