/**
 * Mailpit (shared by every slot). Client that waits for an email to an address
 * and returns its subject, text, HTML and links. Because Mailpit is shared,
 * always send to a unique recipient per test and search by it, never "latest".
 */
import { URLS } from './slot.ts'

export async function assertMailpit(baseUrl: string = URLS.mailpit): Promise<void> {
  try {
    const res = await fetch(new URL('/api/v1/info', baseUrl))
    if (res.ok) return
    throw new Error(`HTTP ${res.status}`)
  } catch (e) {
    throw new Error(`Mailpit is not reachable at ${baseUrl} (${String(e)}). Start it: pnpm docker:dev (or set E2E_MAILPIT_URL).`)
  }
}

export interface MailpitMessage {
  id: string
  subject: string
  text: string
  html: string
  from: { name?: string; address: string }
  to: { name?: string; address: string }[]
  created: string
  links: string[]
}

/** Extract all http(s) links from HTML or text. */
function extractLinks(html: string, text: string): string[] {
  const combined = `${html} ${text}`
  const linkRegex = /https?:\/\/[^\s<>"']+/g
  const matches = combined.match(linkRegex) ?? []
  return [...new Set(matches)]
}

/**
 * Wait for the newest email sent to `toAddress` (case-insensitive) since `since`.
 * Polls Mailpit until one is found or timeoutMs elapses.
 */
export async function waitForEmail(
  toAddress: string,
  { since, timeoutMs = 30_000, baseUrl = URLS.mailpit }: { since?: Date; timeoutMs?: number; baseUrl?: string } = {},
): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs
  const normalizedTo = toAddress.toLowerCase()

  for (;;) {
    const listUrl = new URL('/api/v1/search', baseUrl)
    listUrl.searchParams.set('query', `to:${toAddress}`)
    listUrl.searchParams.set('limit', '50')
    const listRes = await fetch(listUrl)
    if (!listRes.ok) throw new Error(`Mailpit list failed: ${listRes.status}`)
    const data = await listRes.json() as { messages: { ID: string; To?: { Address?: string }[]; Created: string }[] }
    const messages = data.messages ?? []

    const matching = messages.filter((m) => m.To?.some((t) => t.Address?.toLowerCase() === normalizedTo) ?? false)

    const candidate = matching
      .filter((m) => !since || new Date(m.Created) >= since)
      .sort((a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime())[0]

    if (candidate) {
      const msgRes = await fetch(new URL(`/api/v1/message/${candidate.ID}`, baseUrl))
      if (!msgRes.ok) throw new Error(`Mailpit get message failed: ${msgRes.status}`)
      const msg = await msgRes.json()
      return {
        id: msg.ID,
        subject: msg.Subject ?? '',
        text: msg.Text ?? '',
        html: msg.HTML ?? '',
        from: msg.From ?? { address: '' },
        to: msg.To ?? [],
        created: msg.Date ?? msg.Created,
        links: extractLinks(msg.HTML ?? '', msg.Text ?? ''),
      }
    }

    if (Date.now() > deadline) {
      throw new Error(`No email to ${toAddress} found in Mailpit within ${timeoutMs}ms${since ? ` since ${since.toISOString()}` : ''}`)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
}

/**
 * Convenience: request a magic link via the app API, then wait for the email
 * and return the callback URL (the token link).
 */
export async function requestMagicLinkAndWait(
  email: string,
  { language = 'en', baseUrl = URLS.web, since, timeoutMs = 30_000 }: { language?: 'en' | 'bn'; baseUrl?: string; since?: Date; timeoutMs?: number } = {},
): Promise<{ message: MailpitMessage; callbackUrl: string }> {
  const requestSince = since ?? new Date(Date.now() - 1000)
  const res = await fetch(new URL('/api/auth/magic-link/request', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, language }),
  })
  if (!res.ok) throw new Error(`Magic link request failed (${res.status}): ${await res.text()}`)

  const message = await waitForEmail(email, { since: requestSince, timeoutMs, baseUrl: URLS.mailpit })
  const callbackUrl = message.links.find((l) => l.includes('/api/auth/magic-link/callback'))
  if (!callbackUrl) throw new Error(`No magic-link callback URL found in email to ${email}`)
  return { message, callbackUrl }
}

/**
 * Wait for a magic-link email that was already triggered (e.g. by UI submission).
 * Does not make a new request; just polls Mailpit for an email sent since `since`.
 */
export async function waitForMagicLinkEmail(
  email: string,
  { since, timeoutMs = 30_000 }: { since: Date; timeoutMs?: number } = { since: new Date(Date.now() - 1000) },
): Promise<{ message: MailpitMessage; callbackUrl: string }> {
  const message = await waitForEmail(email, { since, timeoutMs, baseUrl: URLS.mailpit })
  const callbackUrl = message.links.find((l) => l.includes('/api/auth/magic-link/callback'))
  if (!callbackUrl) throw new Error(`No magic-link callback URL found in email to ${email}`)
  return { message, callbackUrl }
}