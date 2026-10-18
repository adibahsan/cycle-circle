/**
 * The UI language. The `vesta_lang` cookie is the source of truth so the server can
 * render the same language the client hydrates with (no English flash, no hydration
 * mismatch). Server-safe: no React imports here; the hook lives in use-language.ts. The persisted store keeps a copy for older clients; see langBootScript.
 */
export type Lang = 'en' | 'bn'

export const LANG_COOKIE = 'vesta_lang'

/** Intl locale for the app language: Bengali digits and month names in bn, en-US otherwise. */
export function appLocale(lang: string): 'bn-BD' | 'en-US' {
  return lang === 'bn' ? 'bn-BD' : 'en-US'
}

export function parseLang(value: string | null | undefined): Lang {
  return value === 'bn' ? 'bn' : 'en'
}

export function writeLangCookie(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`
}

/**
 * Inline <head> script. Users who picked Bengali before the cookie existed only have it in
 * localStorage: copy it into the cookie and reload once so the server renders Bengali.
 * Reloads only if the cookie actually stuck, so blocked cookies can't loop.
 */
export function langBootScript(storageKey: string): string {
  return `(function(){try{if(document.cookie.indexOf('${LANG_COOKIE}=')!==-1)return;var s=JSON.parse(localStorage.getItem('${storageKey}')||'{}');if(!s.state||s.state.language!=='bn')return;document.cookie='${LANG_COOKIE}=bn; Path=/; Max-Age=31536000; SameSite=Lax';if(document.cookie.indexOf('${LANG_COOKIE}=bn')!==-1)location.reload()}catch(e){}})()`
}
