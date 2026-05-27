export async function GET() {
  const mailpitUrl = process.env.MAILPIT_UI_URL || 'http://localhost:8025'
  const start = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4000)

  try {
    const response = await fetch(mailpitUrl, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeout)

    const latency = Date.now() - start
    const ok = response.status > 0 && response.status < 500

    if (ok) {
      return Response.json({ status: 'ok', latency, httpStatus: response.status, url: mailpitUrl })
    }

    return Response.json(
      { status: 'error', latency, httpStatus: response.status, url: mailpitUrl, message: response.statusText },
      { status: 503 },
    )
  } catch (e) {
    clearTimeout(timeout)
    const isTimeout = e instanceof Error && e.name === 'AbortError'
    return Response.json(
      {
        status: 'error',
        latency: Date.now() - start,
        url: mailpitUrl,
        message: isTimeout ? 'Connection timed out' : String(e),
      },
      { status: 503 },
    )
  }
}
