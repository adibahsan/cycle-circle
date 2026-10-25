import tseslint from 'typescript-eslint'

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
)
