'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Bookmark, BookmarkCheck, Clock } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import { PageContent } from '@/components/layout/PageContent'
import { DocumentProfileCard } from '@/components/result/DocumentProfileCard'
import { ExtractionTable } from '@/components/result/ExtractionTable'
import { GovernanceFlagList } from '@/components/result/GovernanceFlagList'
import { HumanInLoopBanner } from '@/components/result/HumanInLoopBanner'
import { saveExtraction, getSavedExtraction, APIError } from '@/lib/api'
import type { DocumentIntelligenceResult, SavedExtractionSummary } from '@/lib/types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function ResultPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [result, setResult] = useState<DocumentIntelligenceResult | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const [savedMeta, setSavedMeta] = useState<SavedExtractionSummary | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sessionKey = searchParams.get('key')
    const savedId = searchParams.get('id')

    if (savedId) {
      // Loading from history — fetch from API
      getSavedExtraction(savedId)
        .then(detail => {
          setResult(detail.result)
          setFilename(detail.filename)
          setSavedMeta(detail)
          setSaveState('saved')
        })
        .catch(() => setError('Failed to load saved extraction.'))
      return
    }

    if (sessionKey) {
      try {
        const raw = sessionStorage.getItem(sessionKey)
        if (!raw) { setError('Result has expired. Please upload again.'); return }
        const parsed = JSON.parse(raw) as { result: DocumentIntelligenceResult; filename?: string }
        // Support both wrapped {result, filename} and bare result objects
        if (parsed && 'extraction' in parsed) {
          setResult(parsed as unknown as DocumentIntelligenceResult)
        } else {
          setResult(parsed.result)
          setFilename(parsed.filename ?? null)
        }
      } catch {
        setError('Failed to load result.')
      }
      return
    }

    setError('No result found. Please upload a document first.')
  }, [searchParams])

  const handleSave = async () => {
    if (!result || saveState === 'saving' || saveState === 'saved') return
    setSaveState('saving')
    try {
      const meta = await saveExtraction(filename, result)
      setSavedMeta(meta)
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }

  if (error) {
    return (
      <AuthGuard>
        <PageContent size="medium">
          <div className="rounded-xl border border-dome-error-border bg-dome-error-subtle px-5 py-4">
            <p className="text-sm text-dome-error">{error}</p>
          </div>
          <button onClick={() => router.push('/')} className="mt-4 btn btn-neutral btn-sm">
            Back to upload
          </button>
        </PageContent>
      </AuthGuard>
    )
  }

  if (!result) {
    return (
      <AuthGuard>
        <div className="flex items-center justify-center py-20">
          <div className="spinner spinner-lg" />
        </div>
      </AuthGuard>
    )
  }

  const { extraction, flags, human_in_loop, processing_time_ms } = result
  const isFromHistory = !!searchParams.get('id')

  return (
    <AuthGuard>
      <PageContent size="wide">
        <div className="flex flex-col gap-6">
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(isFromHistory ? '/history' : '/')}
                className="btn btn-neutral btn-sm"
                style={{ gap: 6 }}
              >
                <ArrowLeft size={14} strokeWidth={1.5} />
                {isFromHistory ? 'Back to history' : 'New document'}
              </button>
              {saveState === 'saved' && (
                <button
                  onClick={() => router.push('/history')}
                  className="flex items-center gap-1.5 text-xs text-dome-muted hover:text-dome-text transition-colors"
                >
                  <Clock size={12} strokeWidth={1.5} />
                  View in history
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs text-dome-muted">
                Processed in {(processing_time_ms / 1000).toFixed(1)}s
              </span>
              {!isFromHistory && (
                <button
                  onClick={handleSave}
                  disabled={saveState === 'saving' || saveState === 'saved'}
                  className={`btn btn-sm flex items-center gap-1.5 ${
                    saveState === 'saved' ? 'btn-neutral' : 'btn-secondary'
                  }`}
                  style={{ gap: 6 }}
                >
                  {saveState === 'saved' ? (
                    <>
                      <BookmarkCheck size={14} strokeWidth={1.5} />
                      Saved
                    </>
                  ) : saveState === 'saving' ? (
                    <>
                      <div className="spinner" style={{ width: 12, height: 12 }} />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Bookmark size={14} strokeWidth={1.5} />
                      Save
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {saveState === 'error' && (
            <div className="rounded-lg border border-dome-error-border bg-dome-error-subtle px-4 py-3">
              <p className="text-sm text-dome-error">Failed to save. Please try again.</p>
            </div>
          )}

          {/* Saved metadata banner */}
          {isFromHistory && savedMeta && (
            <div className="rounded-lg border border-dome-border bg-dome-elevated px-4 py-2.5 flex items-center gap-2 text-xs text-dome-muted">
              <BookmarkCheck size={13} strokeWidth={1.5} className="text-dome-success flex-shrink-0" />
              Saved on {new Date(savedMeta.saved_at).toLocaleString()}
              {savedMeta.filename && <span>· {savedMeta.filename}</span>}
            </div>
          )}

          {/* Human-in-loop banner */}
          <HumanInLoopBanner status={human_in_loop} />

          {/* Document profile */}
          <DocumentProfileCard
            profile={extraction.document_profile}
            overallConfidence={extraction.overall_confidence}
          />

          {/* Reference keys */}
          {Object.keys(extraction.reference_keys).length > 0 && (
            <div className="rounded-xl border border-dome-border bg-dome-surface p-5">
              <p className="eyebrow mb-3">Reference keys</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(extraction.reference_keys).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-dome-border bg-dome-elevated px-3 py-2">
                    <span className="text-xs text-dome-muted">{k.replace(/_/g, ' ')}: </span>
                    <span className="text-sm font-medium text-dome-text font-mono">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted fields */}
          <div>
            <p className="eyebrow mb-3">Extracted fields</p>
            <ExtractionTable fields={extraction.fields} />
          </div>

          {/* Governance flags */}
          <div>
            <p className="eyebrow mb-3">Governance flags</p>
            <GovernanceFlagList flags={flags} />
          </div>
        </div>
      </PageContent>
    </AuthGuard>
  )
}
