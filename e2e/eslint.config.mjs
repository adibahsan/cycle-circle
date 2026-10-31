import playwright from 'eslint-plugin-playwright'
import tseslint from 'typescript-eslint'
import local from './eslint-rules/index.mjs'

export default tseslint.config(
  { ignores: ['node_modules/**', '.results/**', '.auth/**', '.logs/**', 'playwright-report/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Playwright fixtures destructure `{}` when they need no other fixture.
      'no-empty-pattern': 'off',
    },
  },
  {
    files: ['tests/**/*.ts', 'support/**/*.ts', 'fixtures/**/*.ts', 'global-setup.ts'],
    plugins: { playwright, local },
    rules: {
      'playwright/no-wait-for-timeout': 'error',
      // Bare landmark/document tags have no CSS coupling and are fine; anything else needs a
      // role/name/label locator or an explicit, reasoned eslint-disable (see REVIEW.md).
      'playwright/no-raw-locators': ['error', { allowed: ['html', 'main', 'header', 'footer', 'h1', 'li', 'table', 'article'] }],
      'playwright/no-force-option': 'error',
      'playwright/no-focused-test': 'error',
      // Conditional skips are allowed: `test.skip(cond, 'why')`. A skip must say why.
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
      'playwright/missing-playwright-await': 'error',
      'playwright/no-page-pause': 'error',
      'local/test-fail-links-issue': 'error',
      // Global singleton rows: one desktop-only writer per row. Add writers here deliberately (README "Global settings rows").
      'local/no-global-setting-writes': ['error', { allow: ['tests/admin/system.spec.ts', 'tests/admin/sms.spec.ts'] }],
    },
  },
)
