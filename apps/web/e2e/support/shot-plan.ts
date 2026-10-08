export const VIEWPORTS = {
  desktop: { width: 1366, height: 900 },
  'phone-375': { width: 375, height: 667 },
  'phone-390': { width: 390, height: 844 },
} as const
export type ViewportName = keyof typeof VIEWPORTS
export type ThemeName = 'light' | 'dark'
export const THEMES: ThemeName[] = ['light', 'dark']

export function shotFileName(label: string, theme: ThemeName, vp: ViewportName): string {
  return `${label}-${theme}-${vp}.png`
}

export function planShots(opts: { label: string; themes?: ThemeName[]; viewports?: ViewportName[] }) {
  const themes = opts.themes ?? THEMES
  const vps = opts.viewports ?? (Object.keys(VIEWPORTS) as ViewportName[])
  return themes.flatMap((theme) =>
    vps.map((viewport) => ({ theme, viewport, file: shotFileName(opts.label, theme, viewport) })),
  )
}
