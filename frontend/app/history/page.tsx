'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import { PageContent } from '@/components/layout/PageContent'
import { HistoryTable } from '@/components/history/HistoryTable'
import { getSavedExtractions, APIError } from '@/lib/api'
import { DOC_TYPE_LABELS } from '@/components/result/DocumentProfileCard'
import type { SavedExtractionSummary } from '@/lib/types'

const PAGE_SIZE = 20

const DOC_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  ...Object.entries(DOC_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]

interface HistoryState {
  extractions: SavedExtractionSummary[]
  total: number
  page: number
}

export default function HistoryPage() {
  const [state, setState] = useState<HistoryState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [docType, setDocType] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (page: number, currentSearch: string, currentDocType: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getSavedExtractions(page, PAGE_SIZE, currentDocType || undefined, currentSearch || undefined)
      setState({ extractions: data.extractions, total: data.total, page: data.page })
    } catch (err) {
      setError(err instanceof APIError ? `Error ${err.status}: ${err.message}` : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(1, search, docType)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const handleSearch = (value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(1, value, docType), 400)
  }

  const handleDocType = (value: string) => {
    setDocType(value)
    load(1, search, value)
  }

  const handleDeleted = (id: string) => {
    setState(prev => prev
      ? { ...prev, extractions: prev.extractions.filter(e => e.id !== id), total: prev.total - 1 }
      : prev
    )
  }

  const totalPages = state ? Math.ceil(state.total / PAGE_SIZE) : 0

  return (
    <AuthGuard>
      <PageContent size="wide">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-dome-text mb-1" style={{ letterSpacing: '-0.01em' }}>
            History
          </h1>
          <p className="text-sm text-dome-muted">
            Saved extractions — click any row to reopen the full result.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* Search */}
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-dome-muted pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by filename…"
              className="w-full rounded-lg border border-dome-border bg-dome-surface text-sm text-dome-text placeholder:text-dome-muted px-3 py-2 pl-8 focus:outline-none focus:border-dome-accent transition-colors"
            />
            {search && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dome-muted hover:text-dome-text"
              >
                <X size={13} strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Doc type filter */}
          <select
            value={docType}
            onChange={e => handleDocType(e.target.value)}
            className="rounded-lg border border-dome-border bg-dome-surface text-sm text-dome-text px-3 py-2 focus:outline-none focus:border-dome-accent transition-colors"
          >
            {DOC_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {state && (
            <span className="text-xs text-dome-muted ml-auto">
              {state.total} {state.total === 1 ? 'document' : 'documents'}
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-dome-error-border bg-dome-error-subtle px-4 py-3 mb-4">
            <p className="text-sm text-dome-error">{error}</p>
          </div>
        )}

        {/* Table */}
        {loading && !state ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner" />
          </div>
        ) : state ? (
          <>
            <div className={loading ? 'opacity-60 pointer-events-none transition-opacity' : ''}>
              <HistoryTable extractions={state.extractions} onDeleted={handleDeleted} />
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
                <span className="text-xs text-dome-muted">
                  Page {state.page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => load(state.page - 1, search, docType)}
                    disabled={state.page <= 1 || loading}
                    className="btn btn-neutral btn-sm"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => load(state.page + 1, search, docType)}
                    disabled={state.page >= totalPages || loading}
                    className="btn btn-neutral btn-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </PageContent>
    </AuthGuard>
  )
}
