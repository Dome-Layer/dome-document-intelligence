'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Trash2, FileText } from 'lucide-react'
import { ConfidencePill } from '@/components/result/ConfidencePill'
import { deleteSavedExtraction, APIError } from '@/lib/api'
import type { SavedExtractionSummary } from '@/lib/types'
import { useIntlLocale, useT } from '@/lib/i18n'
import { labelFor } from '@/lib/labels'

const HITL_CLASS = {
  not_required: 'badge-success',
  recommended: 'badge-warning',
  required: 'badge-error',
} as const

interface HistoryTableProps {
  extractions: SavedExtractionSummary[]
  onDeleted: (id: string) => void
}

export function HistoryTable({ extractions, onDeleted }: HistoryTableProps) {
  const router = useRouter()
  const t = useT()
  const intlLocale = useIntlLocale()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (extractions.length === 0) {
    return (
      <div className="rounded-xl border border-dome-border bg-dome-surface flex flex-col items-center justify-center py-16 gap-3">
        <FileText size={32} strokeWidth={1} className="text-dome-muted" />
        <p className="text-sm text-dome-muted">{t.history.empty}</p>
        <button onClick={() => router.push('/')} className="btn btn-secondary btn-sm mt-1">
          {t.history.uploadCta}
        </button>
      </div>
    )
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t.history.confirmDelete)) return
    setDeletingId(id)
    try {
      await deleteSavedExtraction(id)
      onDeleted(id)
    } catch (err) {
      alert(err instanceof APIError ? err.message : t.history.deleteFailed)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="table-wrapper">
      <table className="dome-table">
        <thead>
          <tr>
            <th>{t.history.columns.document}</th>
            <th>{t.history.columns.type}</th>
            <th>{t.history.columns.industry}</th>
            <th>{t.history.columns.confidence}</th>
            <th>{t.history.columns.review}</th>
            <th>{t.history.columns.saved}</th>
            <th style={{ width: 80 }} />
          </tr>
        </thead>
        <tbody>
          {extractions.map(ex => {
            const hitl = {
              label: t.review.short[ex.human_in_loop] ?? ex.human_in_loop,
              className: HITL_CLASS[ex.human_in_loop] ?? 'badge-neutral',
            }
            const docLabel = labelFor(t.docTypes, ex.doc_type)
            return (
              <tr key={ex.id}>
                <td>
                  <span className="text-sm font-medium text-dome-text truncate max-w-xs block">
                    {ex.filename ?? <span className="text-dome-muted italic">{t.history.cameraCapture}</span>}
                  </span>
                </td>
                <td>
                  <span className="text-sm text-dome-text">{docLabel}</span>
                </td>
                <td>
                  <span className="text-sm text-dome-muted">
                    {ex.industry_hint ? labelFor(t.industries, ex.industry_hint) : t.history.none}
                  </span>
                </td>
                <td>
                  <ConfidencePill value={ex.overall_confidence} />
                </td>
                <td>
                  <span className={`badge ${hitl.className}`}>{hitl.label}</span>
                </td>
                <td>
                  <span className="text-xs text-dome-muted whitespace-nowrap">
                    {new Date(ex.saved_at).toLocaleDateString(intlLocale, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => router.push(`/result?id=${ex.id}`)}
                      className="btn btn-ghost btn-sm p-1.5"
                      title={t.history.view}
                      aria-label={t.history.view}
                    >
                      <Eye size={14} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => handleDelete(ex.id)}
                      disabled={deletingId === ex.id}
                      className="btn btn-ghost btn-sm p-1.5 text-dome-muted hover:text-dome-error"
                      title={t.history.delete}
                      aria-label={t.history.delete}
                    >
                      {deletingId === ex.id
                        ? <div className="spinner" style={{ width: 12, height: 12 }} />
                        : <Trash2 size={14} strokeWidth={1.5} />
                      }
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
