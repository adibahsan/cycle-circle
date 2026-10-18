// Client-safe (no server imports): used by the admin editor and the content service.

/** True when a rich-text value has no visible content (empty, whitespace or an empty Tiptap paragraph). */
export function isBlankBody(html: string | null | undefined): boolean {
  return !html || html.replace(/<p>\s*<\/p>/g, '').trim() === ''
}

/**
 * Editorial warnings shown before publishing (not blocking): missing Bengali translation
 * (title or body) and no cycle-phase tag.
 */
export function articlePublishWarnings(a: {
  status: string
  titleBn?: string | null
  bodyBn?: string | null
  cyclePhases: string[]
}): Array<'bengali' | 'phase'> {
  if (a.status !== 'PUBLISHED') return []
  const out: Array<'bengali' | 'phase'> = []
  if (!a.titleBn?.trim() || isBlankBody(a.bodyBn)) out.push('bengali')
  if (a.cyclePhases.length === 0) out.push('phase')
  return out
}

const WARNING_MESSAGES = {
  bengali: 'no Bengali translation (title and body)',
  phase: 'no cycle phase tag',
} as const

/** Human-readable text for each `articlePublishWarnings` code. */
export function articleWarningMessages(warnings: Array<'bengali' | 'phase'>): string[] {
  return warnings.map((w) => WARNING_MESSAGES[w])
}
