import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8')

describe('shell initial data streams with the page', () => {
  const layout = read('app/(main)/layout.tsx')

  it('layout is a server component that passes getShellInitial() unawaited', () => {
    expect(layout).not.toMatch(/['"]use client['"]/)
    expect(layout).toContain('initial={clientShell ? undefined : getShellInitial()}')
    expect(layout).not.toMatch(/await\s+getShellInitial/)
    // The client-side fallback is an e2e hook only; production always streams the shell data.
    expect(layout).toMatch(/process\.env\.NODE_ENV !== 'production' && \(await cookies\(\)\)\.has\('vesta_e2e_client_shell'\)/)
  })

  it('MainShell skips the mount fetch when initial is provided', () => {
    const shell = read('components/shell/MainShell.tsx')
    expect(shell).toMatch(/if \(!initial\) \{\s*fallbackFetchAll\(\)/)
    expect(shell).toContain('initial.then(')
    expect(shell).toMatch(/prevPercentRef\.current = data\.completion\.percent/)
    expect(shell).toContain('cancelled')
    // the profile-updated refresh path stays client-fetched
    expect(shell).toContain("addEventListener('vesta:profile-updated'")
  })

  it('shell-queries resolves the active profile via the cookie like the route handlers', () => {
    const q = read('app/queries/shell-queries.ts')
    expect(q).toContain("'vesta_active_profile'")
    expect(q).toContain('getLoggingStatus')
    expect(q).toContain('getProfileCompletionStatus')
    expect(q).toMatch(/catch \{\s*return null/)
  })

  it('ProfileChip shows a placeholder, not "Profile", while the name is pending', () => {
    const chip = read('components/shell/ProfileChip.tsx')
    expect(chip).toContain('pending')
    expect(chip).toContain('motion-reduce:animate-none')
  })
})
