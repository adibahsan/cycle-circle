export type Theme = 'light' | 'dark'

/** Stored choice if valid, otherwise the system preference. */
export function resolveTheme(stored: unknown, prefersDark: boolean): Theme {
  if (stored === 'dark' || stored === 'light') return stored
  return prefersDark ? 'dark' : 'light'
}

/** True when the OS prefers dark. Safe on the server and in old browsers. */
export function systemPrefersDark(): boolean {
  try {
    const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia
    return !!mm?.('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/**
 * Inline script run in <head> before first paint. Reads the zustand-persisted
 * store under `storageKey` (shape `{ state: { theme } }`), falls back to the
 * system preference, then sets the `dark` class and `color-scheme` on <html>.
 * Never throws (blocked or corrupt storage falls back to the system theme).
 */
export function themeBootScript(storageKey: string): string {
  return `(function(){try{var t=null;try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)})||'null');t=s&&s.state&&s.state.theme}catch(e){}if(t!=='dark'&&t!=='light'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}var d=document.documentElement;d.classList.toggle('dark',t==='dark');d.style.colorScheme=t}catch(e){}})();`
}
