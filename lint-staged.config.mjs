// Lint staged files with the ESLint config of the package each file belongs to
// (there is no root ESLint config; every package runs `eslint .` on its own).
import path from 'node:path'

const PACKAGES = ['apps/web', 'apps/admin', 'packages/shared', 'e2e']
const root = process.cwd()

export default {
  '*.{ts,tsx,js,mjs,cjs}': (files) => {
    const byPackage = new Map()
    for (const file of files) {
      const rel = path.relative(root, file)
      const pkg = PACKAGES.find((p) => rel === p || rel.startsWith(`${p}/`))
      if (!pkg) continue
      byPackage.set(pkg, [...(byPackage.get(pkg) ?? []), file])
    }
    return [...byPackage].map(
      ([pkg, pkgFiles]) =>
        `pnpm --dir ${pkg} exec eslint --no-warn-ignored ${pkgFiles.map((f) => JSON.stringify(f)).join(' ')}`,
    )
  },
}
