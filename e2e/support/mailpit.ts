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
