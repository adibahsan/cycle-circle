import { defineConfig } from 'vitest/config'
import path from 'path'

// Test files run in parallel against one database. A file that asserts on global
// counts (every user, every profile) can't be right while other files write, so it
// runs in a second group, alone, after the parallel group has finished.
const SERIAL = [
  '__tests__/services/dashboard-freshness.test.ts',
  '__tests__/services/pro-snapshot.test.ts',
  '__tests__/services/admin-kpis-dashboard.test.ts',
  '__tests__/services/overview-metrics.test.ts',
]

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Picks/creates/migrates a dedicated test DB and exports DATABASE_URL (never vesta_dev).
    globalSetup: ['__tests__/helpers/global-setup.ts'],
    setupFiles: ['__tests__/helpers/setup-env.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'parallel',
          include: ['__tests__/**/*.test.ts'],
          exclude: SERIAL,
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: 'serial',
          include: SERIAL,
          // Files in this group assert on global counts, so they also run one at a time.
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
