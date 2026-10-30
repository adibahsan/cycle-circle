import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { maintenanceUrl, recreateDatabase, resetStatements } from './reset-db.ts'

const server = 'postgresql://vesta_user:vesta_dev@localhost:5431'

describe('E2E database reset guard', () => {
  it('drops and recreates only the slot database', () => {
    assert.deepEqual(resetStatements(`${server}/vesta_e2e_17?connection_limit=5`), [
      'DROP DATABASE IF EXISTS "vesta_e2e_17" WITH (FORCE)',
      'CREATE DATABASE "vesta_e2e_17"',
    ])
    assert.equal(resetStatements(`${server}/vesta_e2e`)[1], 'CREATE DATABASE "vesta_e2e"')
  })

  it('refuses vesta_dev', async () => {
    assert.throws(() => resetStatements(`${server}/vesta_dev`), /Refusing/)
    await assert.rejects(recreateDatabase(`${server}/vesta_dev`), /Refusing/)
  })

  it('refuses look-alike names and the maintenance database', () => {
    for (const name of ['postgres', 'vesta_e2e_', 'vesta_e2e_x', 'vesta_e2e_1; DROP DATABASE vesta_dev', 'xvesta_e2e', 'vesta_e2e_1_2']) {
      assert.throws(() => resetStatements(`${server}/${encodeURIComponent(name)}`), /Refusing/, name)
    }
  })

  it('connects to the postgres maintenance database on the same server', () => {
    const url = new URL(maintenanceUrl(`${server}/vesta_e2e_3?connection_limit=5`))
    assert.equal(url.pathname, '/postgres')
    assert.equal(url.port, '5431')
  })
})
