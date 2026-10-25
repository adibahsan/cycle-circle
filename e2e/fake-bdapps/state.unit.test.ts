/**
 * Unit-ish checks for FailureMatch (no HTTP server).
 * Run: `pnpm exec tsx --test fake-bdapps/state.unit.test.ts` from e2e/.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createState, failureMatches, validateFailure } from './state.ts'

const state = createState({
  appId: 'app',
  password: 'pw',
  appUrl: 'http://localhost:3000',
})

describe('failureMatches messageContains', () => {
  it('matches only when body.message includes the substring', () => {
    const match = { messageContains: 'UNIQUE-MARKER' }
    assert.equal(
      failureMatches(state, match, { message: 'hello UNIQUE-MARKER world', destinationAddresses: ['tel:all'] }),
      true,
    )
    assert.equal(
      failureMatches(state, match, { message: 'other broadcast', destinationAddresses: ['tel:all'] }),
      false,
    )
  })

  it('still requires destinationAddress when both are set', () => {
    const match = { destinationAddress: 'tel:all', messageContains: 'M1' }
    assert.equal(
      failureMatches(state, match, { message: 'M1', destinationAddresses: ['tel:all'] }),
      true,
    )
    assert.equal(
      failureMatches(state, match, { message: 'M1', destinationAddresses: ['tel:other'] }),
      false,
    )
  })
})

describe('validateFailure messageContains', () => {
  it('accepts messageContains as a match field', () => {
    assert.equal(
      validateFailure({
        path: '/sms/send',
        mode: 'error',
        match: { messageContains: 'x' },
      }),
      undefined,
    )
  })
})
