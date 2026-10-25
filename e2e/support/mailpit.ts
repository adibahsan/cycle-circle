/**
 * Mailpit (shared by every slot). Only a reachability check for now; the client that
 * waits for an email to an address lands with the magic-link ticket. Because Mailpit is
 * shared, always send to a unique recipient per test and search by it, never "latest".
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

/**
 * Wait for an email addressed to `recipient` in Mailpit and return its content.
 * Matches on the recipient address and (optionally) a `since` timestamp.
 */
export async function latestEmailFor(
  recipient: string,
  opts: { since?: Date; timeoutMs?: number; baseUrl?: string } = {},
): Promise<{ id: string; subject: string; text: string; html: string }> {
  const baseUrl = opts.baseUrl ?? URLS.mailpit
  const timeoutMs = opts.timeoutMs ?? 10_000
  const deadline = Date.now() + timeoutMs
  const sinceTime = opts.since ? opts.since.getTime() : 0

  while (Date.now() < deadline) {
    const res = await fetch(new URL(`/api/v1/search?query=${encodeURIComponent(recipient)}`, baseUrl))
    if (res.ok) {
      const data = (await res.json()) as { messages?: Array<{ ID: string; Created: string; To?: Array<{ Address: string }> }> }
      const match = (data.messages ?? []).find(
        (m) =>
          (!m.To || m.To.some((t) => t.Address.toLowerCase() === recipient.toLowerCase())) &&
          new Date(m.Created).getTime() >= sinceTime - 1000,
      )
      if (match) {
        const detailRes = await fetch(new URL(`/api/v1/message/${match.ID}`, baseUrl))
        if (detailRes.ok) {
          const detail = (await detailRes.json()) as { Subject: string; Text: string; HTML: string }
          return { id: match.ID, subject: detail.Subject, text: detail.Text, html: detail.HTML }
        }
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`No email for ${recipient} arrived within ${timeoutMs}ms`)
}

