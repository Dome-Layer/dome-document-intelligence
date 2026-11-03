'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Bookmark, BookmarkCheck, Clock } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import { PageContent } from '@/components/layout/PageContent'
import { DocumentProfileCard } from '@/components/result/DocumentProfileCard'
import { ExtractionTable } from '@/components/result/ExtractionTable'
import { GovernanceFlagList } from '@/components/result/GovernanceFlagList'
import { HumanInLoopBanner } from '@/components/result/HumanInLoopBanner'
import { saveExtraction, getSavedExtraction } from '@/lib/api'
import type { DocumentIntelligenceResult, SavedExtractionSummary } from '@/lib/types'
import { useIntlLocale, useT } from '@/lib/i18n'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Which load error to show; worded at render time, so it follows a language change. */
type LoadError = 'failedSaved' | 'expired' | 'failedLoad' | 'noResult'

// Inner component: uses useSearchParams(), must be inside <Suspense>
function ResultPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useT()
  const intlLocale = useIntlLocale()

  const [result, setResult] = useState<DocumentIntelligenceResult | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const [savedMeta, setSavedMeta] = useState<SavedExtractionSummary | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState<LoadError | null>(null)

  useEffect(() => {
    const sessionKey = searchParams.get('key')
    const savedId = searchParams.get('id')

    if (savedId) {
      getSavedExtraction(savedId)
        .then(detail => {
          setResult(detail.result)
          setFilename(detail.filename)
          setSavedMeta(detail)
          setSaveState('saved')
        })
        .catch(() => setError('failedSaved'))
      return
    }

    if (sessionKey) {
      try {
        const raw = sessionStorage.getItem(sessionKey)
        if (!raw) { setError('expired'); return }
        const parsed = JSON.parse(raw) as { result: DocumentIntelligenceResult; filename?: string }
        if (parsed && 'extraction' in parsed) {
          setResult(parsed as unknown as DocumentIntelligenceResult)
        } else {
          setResult(parsed.result)
          setFilename(parsed.filename ?? null)
        }
      } catch {
        setError('failedLoad')
      }
      return
    }

    setError('noResult')
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
            <p className="text-sm text-dome-error">{t.result[error]}</p>
          </div>
          <button onClick={() => router.push('/')} className="mt-4 btn btn-neutral btn-sm">
            {t.result.backToUpload}
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
                {isFromHistory ? t.result.backToHistory : t.result.newDocument}
              </button>
              {saveState === 'saved' && (
                <button
                  onClick={() => router.push('/history')}
                  className="flex items-center gap-1.5 text-xs text-dome-muted hover:text-dome-text transition-colors"
                >
                  <Clock size={12} strokeWidth={1.5} />
                  {t.result.viewInHistory}
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs text-dome-muted">
                {t.result.processedIn(
                  new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
                    processing_time_ms / 1000,
                  ),
                )}
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
                      {t.result.saved}
                    </>
                  ) : saveState === 'saving' ? (
                    <>
                      <div className="spinner" style={{ width: 12, height: 12 }} />
                      {t.result.saving}
                    </>
                  ) : (
                    <>
                      <Bookmark size={14} strokeWidth={1.5} />
                      {t.result.save}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {saveState === 'error' && (
            <div className="rounded-lg border border-dome-error-border bg-dome-error-subtle px-4 py-3">
              <p className="text-sm text-dome-error">{t.result.saveFailed}</p>
            </div>
          )}

          {/* Saved metadata banner */}
          {isFromHistory && savedMeta && (
            <div className="rounded-lg border border-dome-border bg-dome-elevated px-4 py-2.5 flex items-center gap-2 text-xs text-dome-muted">
              <BookmarkCheck size={13} strokeWidth={1.5} className="text-dome-success flex-shrink-0" />
              {t.result.savedOn(new Date(savedMeta.saved_at).toLocaleString(intlLocale))}
              {savedMeta.filename && <span>· {savedMeta.filename}</span>}
            </div>
          )}

          <HumanInLoopBanner status={human_in_loop} />

          <DocumentProfileCard
            profile={extraction.document_profile}
            overallConfidence={extraction.overall_confidence}
          />

          {Object.keys(extraction.reference_keys).length > 0 && (
            <div className="rounded-xl border border-dome-border bg-dome-surface p-5">
              <p className="eyebrow mb-3">{t.result.referenceKeys}</p>
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

          <div>
            <p className="eyebrow mb-3">{t.result.extractedFields}</p>
            <ExtractionTable fields={extraction.fields} />
          </div>

          <div>
            <p className="eyebrow mb-3">{t.result.governanceFlags}</p>
            <GovernanceFlagList flags={flags} />
          </div>
        </div>
      </PageContent>
    </AuthGuard>
  )
}

// Outer shell: wraps the inner component in Suspense as required by Next.js 14
export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="spinner spinner-lg" />
        </div>
      }
    >
      <ResultPageContent />
    </Suspense>
  )
}
