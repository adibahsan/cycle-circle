export async function GET() {
  const simulatorUrl =
    process.env.BDAPPS_SIMULATOR_UI_URL ||
    'http://localhost:10001/mchoice-tap-sdk'

  const start = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4000)

  try {
    const response = await fetch(simulatorUrl, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeout)

    const latency = Date.now() - start
    const ok = response.status > 0 && response.status < 500

    if (ok) {
      return Response.json({ status: 'ok', latency, httpStatus: response.status, url: simulatorUrl })
    }

    return Response.json(
      { status: 'error', latency, httpStatus: response.status, url: simulatorUrl, message: response.statusText },
      { status: 503 },
    )
  } catch (e) {
    clearTimeout(timeout)
    const isTimeout = e instanceof Error && e.name === 'AbortError'
    return Response.json(
      {
        status: 'error',
        latency: Date.now() - start,
        url: simulatorUrl,
        message: isTimeout ? 'Connection timed out' : String(e),
      },
      { status: 503 },
    )
  }
}
