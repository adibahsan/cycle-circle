import { describe, it, expect } from 'vitest'
import { resolveTestDatabaseUrl } from './global-setup'

describe('test database isolation', () => {
  it('workers see the database chosen by globalSetup, never vesta_dev', () => {
    const name = new URL(process.env.DATABASE_URL!).pathname.slice(1)
    expect(name).toBe(process.env.VESTA_TEST_DB_NAME)
    expect(name).not.toBe('vesta_dev')
    expect(process.env.DIRECT_URL).toBe(process.env.DATABASE_URL)
  })

  it('switches a dev URL to vesta_test locally and refuses unknown names', () => {
    const dev = 'postgresql://u:p@localhost:5431/vesta_dev?schema=public'
    expect(resolveTestDatabaseUrl({ DATABASE_URL: dev })).toBe('postgresql://u:p@localhost:5431/vesta_test?schema=public')
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: dev, TEST_DATABASE_URL: 'postgresql://u:p@h/vesta_dev' })).toThrow(/Refusing/)
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: 'postgresql://u:p@h/vesta_ci' })).not.toThrow()
    expect(resolveTestDatabaseUrl({ DATABASE_URL: 'postgresql://u:p@h/vesta_ci', CI: '1' })).toContain('/vesta_ci')
  })
})
