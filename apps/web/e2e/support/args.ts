import { POPUPS } from './popups'
import { MOCKS } from './mocks'
import { PERSONAS, type PersonaName } from './personas'
import { VIEWPORTS, type ThemeName, type ViewportName } from './shot-plan'

export interface ShotArgs {
  route: string
  popup?: string
  mocks: string[]
  persona: PersonaName
  themes?: ThemeName[]
  viewports?: ViewportName[]
  label: string
  fullPage: boolean
}

function list<T extends string>(v: string, allowed: readonly string[], what: string): T[] {
  const items = v.split(',').map((s) => s.trim()).filter(Boolean)
  for (const i of items) if (!allowed.includes(i)) throw new Error(`Unknown ${what} "${i}". Allowed: ${allowed.join(', ')}`)
  return items as T[]
}

export function parseShotArgs(argv: string[]): ShotArgs {
  const raw = new Map<string, string>()
  let fullPage = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--full-page') { fullPage = true; continue }
    if (a.startsWith('--')) raw.set(a.slice(2), argv[++i] ?? '')
  }
  const route = raw.get('route')
  if (!route) throw new Error('Missing --route (e.g. --route /dashboard)')
  const popup = raw.get('popup')
  if (popup && !POPUPS[popup]) throw new Error(`Unknown popup "${popup}". Allowed: ${Object.keys(POPUPS).join(', ')}`)
  const mocks = raw.has('mock') ? list<string>(raw.get('mock')!, Object.keys(MOCKS), 'mock') : []
  const persona = (raw.get('persona') ?? 'seed') as string
  if (!(persona in PERSONAS)) throw new Error(`Unknown persona "${persona}". Allowed: ${Object.keys(PERSONAS).join(', ')}`)
  const slug = route.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'home'
  const label = raw.get('label') ?? [slug, popup, ...mocks].filter(Boolean).join('-')
  return {
    route, popup, mocks, persona: persona as PersonaName, label, fullPage,
    themes: raw.has('themes') ? list<ThemeName>(raw.get('themes')!, ['light', 'dark'], 'theme') : undefined,
    viewports: raw.has('viewports') ? list<ViewportName>(raw.get('viewports')!, Object.keys(VIEWPORTS), 'viewport') : undefined,
  }
}
