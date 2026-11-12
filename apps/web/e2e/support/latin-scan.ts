/**
 * Bengali no-English guard. `collectTexts` runs in the page and returns every text node and accessible
 * attribute under <body>. `latinOffenders` (pure, unit-tested) keeps the ones that still hold Latin letters
 * after the narrow allow-list below is removed.
 */
import type { Page } from '@playwright/test'

/**
 * Text that stays Latin in Bengali, on purpose. Anything else with Latin letters is a missed translation.
 *  - the brand name
 *  - names of third-party products and standards that the legal and billing copy cites by name
 *  - SI units after a number
 *  - contact data locked verbatim by __tests__/utils/rebrand-copy.test.ts (email, postal address)
 * User-entered content (profile names) is passed in per test as `userStrings`.
 */
export const LATIN_ALLOW: { pattern: RegExp; reason: string }[] = [
  { pattern: /Cycle Circle/g, reason: 'brand name' },
  { pattern: /\bPro\b/g, reason: 'plan name, quoted verbatim in the BDApps subscription copy (ADR 0002)' },
  { pattern: /\b(?:BDApps|CAAS|Grameenphone|Cirkle|Supabase|PostgreSQL|AWS|Resend|ARIMA)\b/g, reason: 'third-party product and algorithm names' },
  { pattern: /\b(?:AES-256-GCM|TLS 1\.3|SOC 2)\b/g, reason: 'security standard identifiers' },
  { pattern: /(?<=[\d\u09E6-\u09EF]\s?)(?:kg|cm|mm|ml|mg|°C|°F|bpm)\b/g, reason: 'SI units after a number' },
  { pattern: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, reason: 'email addresses' },
  { pattern: /AWR U Tower, Plot 35, Road 133, Gulshan 1, Dhaka 1212/g, reason: 'postal address, identical in both languages' },
]

export function stripAllowed(text: string, userStrings: string[] = []): string {
  const noUser = userStrings.filter(Boolean).reduce((acc, u) => acc.split(u).join(' '), text)
  return LATIN_ALLOW.reduce((acc, { pattern }) => acc.replace(pattern, ' '), noUser)
}

export interface Collected { kind: 'text' | 'attr'; where: string; value: string }

export function latinOffenders(items: Collected[], userStrings: string[] = []): Collected[] {
  return items.filter((i) => /[A-Za-z]/.test(stripAllowed(i.value, userStrings)))
}

const ATTRS = ['aria-label', 'title', 'alt', 'placeholder', 'aria-roledescription', 'aria-description', 'aria-valuetext']

/** Runs inside the page. Skips scripts, styles, the Next dev overlay and the route announcer, and user content. */
export async function collectTexts(page: Page, rootSelector = 'body'): Promise<Collected[]> {
  return page.evaluate(
    ({ rootSelector, attrs }) => {
      const root = document.querySelector(rootSelector)
      if (!root) return []
      const skip = (el: Element | null): boolean =>
        !!el?.closest('script, style, noscript, nextjs-portal, next-route-announcer, [data-user-content], [data-nextjs-toast]')
      const describe = (el: Element) =>
        `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.getAttribute('data-testid') ? `[${el.getAttribute('data-testid')}]` : ''}`
      const out: { kind: 'text' | 'attr'; where: string; value: string }[] = []
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const v = (n.nodeValue ?? '').replace(/\s+/g, ' ').trim()
        if (v && !skip(n.parentElement)) out.push({ kind: 'text', where: describe(n.parentElement!), value: v })
      }
      const sel = attrs.map((a) => `[${a}]`).join(',')
      for (const el of Array.from(root.querySelectorAll(sel)).concat(root.matches(sel) ? [root] : [])) {
        if (skip(el)) continue
        for (const a of attrs) {
          const v = el.getAttribute(a)
          if (v && v.trim()) out.push({ kind: 'attr', where: `${describe(el)}@${a}`, value: v.trim() })
        }
      }
      return out
    },
    { rootSelector, attrs: ATTRS },
  )
}
