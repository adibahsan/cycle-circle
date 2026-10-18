import type { Locator } from '@playwright/test'

export const EMOJI = /\p{Extended_Pictographic}/u

/** Visible text and accessible labels under `root` that contain an emoji (aria-hidden subtrees skipped). */
export async function emojiIn(root: Locator): Promise<string[]> {
  const texts = await root.evaluate((el) => {
    const out: string[] = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement
      if (p && p.closest('[aria-hidden="true"]') == null && p.offsetParent !== null) out.push(n.textContent ?? '')
    }
    el.querySelectorAll('[aria-label]').forEach((e) => out.push(e.getAttribute('aria-label') ?? ''))
    return out
  })
  return texts.filter((t) => EMOJI.test(t))
}
