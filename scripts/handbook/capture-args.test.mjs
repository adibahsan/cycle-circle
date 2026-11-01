import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCaptureArgs } from './capture-args.mjs'

const config = '--config=playwright.handbook.config.ts'

test('bare filter passes through', () => {
  assert.deepEqual(normalizeCaptureArgs(['--', config, 'gs-tour']), [config, 'gs-tour'])
})

test('filter after an extra -- is accepted too', () => {
  assert.deepEqual(normalizeCaptureArgs(['--', config, '--', 'gs-tour']), [config, 'gs-tour'])
})

test('no filter keeps only the config', () => {
  assert.deepEqual(normalizeCaptureArgs(['--', config]), [config])
})
