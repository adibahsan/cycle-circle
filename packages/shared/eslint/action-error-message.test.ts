import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
// @ts-expect-error plain .mjs rule
import { actionErrorMessageRule } from './action-error-message.mjs'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } })
const ACTION = "import { createProfile } from '@/app/actions/profile-actions'\n"

tester.run('no-action-error-message', actionErrorMessageRule, {
  valid: [
    // no server action imported: a fetch error we wrote ourselves may be shown
    "try { await fetch('/x') } catch (e) { setError(e instanceof Error ? e.message : 'x') }",
    // translated copy for a server-action failure
    `${ACTION}try { await createProfile({}) } catch { setError(t('profiles.serverError')) }`,
    // a message that isn't the caught error's
    `${ACTION}const m = other instanceof Error ? 'failed' : 'ok'`,
  ],
  invalid: [
    { code: `${ACTION}try { await createProfile({}) } catch (err) { setError(err instanceof Error ? err.message : 'x') }`, errors: [{ messageId: 'raw' }] },
    { code: "import { a } from '../actions/x'\ntry { await a() } catch (e) { show(e instanceof Error ? e.message : String(e)) }", errors: [{ messageId: 'raw' }] },
  ],
})
