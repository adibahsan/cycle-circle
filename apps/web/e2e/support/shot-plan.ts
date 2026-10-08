export const VIEWPORTS = {
  desktop: { width: 1366, height: 900 },
  'tablet-1024': { width: 1024, height: 768 },
  'phone-375': { width: 375, height: 667 },
  'phone-390': { width: 390, height: 844 },
} as const
export type ViewportName = keyof typeof VIEWPORTS
/** tablet-1024 is opt-in via --viewports. */
export const DEFAULT_VIEWPORTS: ViewportName[] = ['desktop', 'phone-375', 'phone-390']
export type ThemeName = 'light' | 'dark'
export const THEMES: ThemeName[] = ['light', 'dark']

export function shotFileName(label: string, theme: ThemeName, vp: ViewportName): string {
  return `${label}-${theme}-${vp}.png`
}

export function planShots(opts: { label: string; themes?: ThemeName[]; viewports?: ViewportName[] }) {
  const themes = opts.themes ?? THEMES
  const vps = opts.viewports ?? DEFAULT_VIEWPORTS
  return themes.flatMap((theme) =>
    vps.map((viewport) => ({ theme, viewport, file: shotFileName(opts.label, theme, viewport) })),
  )
}
