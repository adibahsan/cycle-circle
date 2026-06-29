'use client'

import Script from 'next/script'
import { useCallback } from 'react'

// Swagger UI is loaded from self-hosted assets in /public/swagger-ui (no npm
// dependency, no CDN — satisfies the admin CSP which only allows 'self').
// The spec is served as the static file /openapi.yaml (apps/admin/public).
declare global {
  interface Window {
    SwaggerUIBundle?: (opts: Record<string, unknown>) => unknown
  }
}

export default function ApiDocsPage() {
  // `onReady` (not `onLoad`) re-fires on client re-navigation back to this page,
  // so the widget re-initialises into the fresh #swagger-ui node each time.
  const initSwaggerUi = useCallback(() => {
    if (typeof window === 'undefined' || !window.SwaggerUIBundle) return
    window.SwaggerUIBundle({
      url: '/openapi.yaml',
      dom_id: '#swagger-ui',
      deepLinking: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 0,
      tryItOutEnabled: false,
    })
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {/* Self-hosted Swagger UI stylesheet (React 19 hoists to <head>). */}
      <link rel="stylesheet" href="/swagger-ui/swagger-ui.css" precedence="default" />

      <header>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">API Reference</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          OpenAPI 3.1 reference for the Vesta REST API. Spec:{' '}
          <a
            href="/openapi.yaml"
            className="underline hover:text-[var(--color-primary)]"
            target="_blank"
            rel="noopener noreferrer"
          >
            /openapi.yaml
          </a>
          . Reference only — &ldquo;Try it out&rdquo; is disabled because the live
          API runs on a different origin and uses httpOnly-cookie auth.
        </p>
      </header>

      {/* Swagger UI mounts here. Light surface so its theme renders cleanly. */}
      <div
        id="swagger-ui"
        className="rounded-2xl bg-white overflow-hidden border border-[var(--color-border)]"
      />

      <Script
        src="/swagger-ui/swagger-ui-bundle.js"
        strategy="afterInteractive"
        onReady={initSwaggerUi}
      />
    </div>
  )
}
