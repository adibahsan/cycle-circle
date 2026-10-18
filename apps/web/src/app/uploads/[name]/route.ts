import fs from 'node:fs/promises'
import { resolveUploadFile } from '@vesta/shared/server/services'

export const dynamic = 'force-dynamic'

/** Serves article images from the uploads volume (`/uploads/<generated-name>`). */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const file = resolveUploadFile(name)
  if (!file) return new Response('Not found', { status: 404 })
  try {
    const data = await fs.readFile(file.filePath)
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': file.contentType,
        'Content-Length': String(data.length),
        // Generated names are never reused, so the bytes behind a URL never change.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
