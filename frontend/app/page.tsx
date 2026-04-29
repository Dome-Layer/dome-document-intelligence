'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthGuard from '@/components/AuthGuard'
import { PageContent } from '@/components/layout/PageContent'
import UploadZone from '@/components/upload/UploadZone'
import { extractDocument, APIError } from '@/lib/api'
import type { DocumentIntelligenceResult } from '@/lib/types'

type Step = 'detecting' | 'extracting' | 'validating'

type State =
  | { status: 'idle' }
  | { status: 'running'; step: Step; filename: string }
  | { status: 'error'; message: string }

const STEP_LABELS: Record<Step, string> = {
  detecting: 'Detecting document type…',
  extracting: 'Extracting fields…',
  validating: 'Applying governance rules…',
}

const STEP_ORDER: Step[] = ['detecting', 'extracting', 'validating']

export default function UploadPage() {
  const router = useRouter()
  const [state, setState] = useState<State>({ status: 'idle' })

  const runExtraction = useCallback(
    async (file: File) => {
      setState({ status: 'running', step: 'detecting', filename: file.name })

      // Advance status text through the three stages while the single API call runs
      let stepIdx = 0
      const advanceInterval = setInterval(() => {
        stepIdx = Math.min(stepIdx + 1, STEP_ORDER.length - 1)
        setState(prev =>
          prev.status === 'running'
            ? { ...prev, step: STEP_ORDER[stepIdx] }
            : prev
        )
      }, 2000)

      try {
        const result: DocumentIntelligenceResult = await extractDocument(file)
        clearInterval(advanceInterval)

        // Store result + filename in sessionStorage — no document content, just structured data
        const key = `dome_doc_result_${Date.now()}`
        sessionStorage.setItem(key, JSON.stringify({ result, filename: file.name }))

        router.push(`/result?key=${encodeURIComponent(key)}`)
      } catch (err) {
        clearInterval(advanceInterval)
        const message =
          err instanceof APIError
            ? `Error ${err.status}: ${err.message}`
            : err instanceof Error
            ? err.message
            : 'An unexpected error occurred'
        setState({ status: 'error', message })
      }
    },
    [router],
  )

  const onFile = useCallback(
    (file: File) => {
      runExtraction(file)
    },
    [runExtraction],
  )

  const onError = useCallback((message: string) => {
    setState({ status: 'error', message })
  }, [])

  return (
    <AuthGuard>
      <PageContent size="wide">
        <div className="max-w-xl mx-auto">
          <div className="mb-8">
            <h1 className="text-xl font-600 text-dome-text mb-1" style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>
              Document Intelligence
            </h1>
            <p className="text-sm text-dome-muted">
              Upload any document — invoices, lab reports, utility bills, contracts. Extract structured data with governance validation in seconds.
            </p>
          </div>

          {state.status === 'running' ? (
            <ProcessingCard step={state.step} filename={state.filename} />
          ) : (
            <UploadZone
              onFile={onFile}
              onError={onError}
              disabled={false}
            />
          )}

          {state.status === 'error' && (
            <div className="mt-4 rounded-lg border border-dome-error-border bg-dome-error-subtle px-4 py-3">
              <p className="text-sm text-dome-error">{state.message}</p>
              <button
                onClick={() => setState({ status: 'idle' })}
                className="mt-2 text-xs text-dome-muted underline hover:text-dome-text"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </PageContent>
    </AuthGuard>
  )
}

function ProcessingCard({ step, filename }: { step: Step; filename: string }) {
  return (
    <div className="rounded-xl border border-dome-border bg-dome-surface p-8 flex flex-col items-center gap-5 text-center">
      <div className="spinner spinner-lg" />
      <div>
        <p className="text-base font-medium text-dome-text mb-1">{STEP_LABELS[step]}</p>
        <p className="text-xs text-dome-muted truncate max-w-xs">{filename}</p>
      </div>
      <div className="flex gap-1.5">
        {STEP_ORDER.map(s => (
          <div
            key={s}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: s === step ? 24 : 8,
              background: s === step
                ? 'var(--color-accent)'
                : STEP_ORDER.indexOf(s) < STEP_ORDER.indexOf(step)
                ? 'var(--color-success)'
                : 'var(--color-border-default)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
