'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getEmailPreviewHtml } from './actions'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'

type TemplateKey = 'period-alert' | 'fertile-window' | 'logging-reminder'
type Language = 'en' | 'bn'

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  'period-alert': 'Period Alert',
  'fertile-window': 'Fertile Window',
  'logging-reminder': 'Logging Reminder',
}

export function EmailPreviewClient() {
  const [template, setTemplate] = useState<TemplateKey>('period-alert')
  const [language, setLanguage] = useState<Language>('en')
  const [html, setHtml] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const result = await getEmailPreviewHtml(template, language)
      setHtml(result)
    })
  }, [template, language])

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/emails"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to Email Logs
      </Link>

      <AdminPageHeader
        title="Email Preview"
        description="Preview transactional email templates as they appear to recipients."
        tags={[]}
      />

      {/* Controls card */}
      <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="flex flex-wrap items-end gap-4">
          {/* Template selector */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="template-select"
              className="text-xs font-medium text-gray-600"
            >
              Template
            </label>
            <select
              id="template-select"
              value={template}
              onChange={(e) => setTemplate(e.target.value as TemplateKey)}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus-visible:border-pink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/30"
            >
              {(
                Object.entries(TEMPLATE_LABELS) as [TemplateKey, string][]
              ).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Language toggle */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-600">Language</span>
            <div
              role="group"
              aria-label="Language"
              className="flex rounded-md border border-gray-200 bg-gray-50 p-0.5"
            >
              {(['en', 'bn'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  aria-pressed={language === lang}
                  className={[
                    'rounded px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500',
                    language === lang
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700',
                  ].join(' ')}
                >
                  {lang === 'en' ? 'EN' : 'BN'}
                </button>
              ))}
            </div>
          </div>

          {/* Status indicator */}
          {isPending && (
            <p
              aria-live="polite"
              className="text-sm text-gray-400"
            >
              Loading preview…
            </p>
          )}
        </div>
      </div>

      {/* Preview card */}
      <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Preview — {TEMPLATE_LABELS[template]}
        </h2>

        <div className="flex justify-center rounded-md border border-gray-200 bg-gray-50 p-4">
          {html ? (
            <iframe
              title={`Email preview: ${TEMPLATE_LABELS[template]}`}
              srcDoc={html}
              sandbox=""
              className="h-[640px] w-full max-w-[600px] rounded border-0 bg-white"
              aria-label={`Rendered email preview for ${TEMPLATE_LABELS[template]} in ${language === 'en' ? 'English' : 'Bengali'}`}
            />
          ) : (
            <div
              aria-live="polite"
              className="flex h-[640px] w-full max-w-[600px] items-center justify-center rounded border border-dashed border-gray-200 bg-white text-sm text-gray-400"
            >
              {isPending ? 'Generating preview…' : 'Select a template to preview'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
