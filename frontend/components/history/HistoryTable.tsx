'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Trash2, FileText } from 'lucide-react'
import { ConfidencePill } from '@/components/result/ConfidencePill'
import { deleteSavedExtraction, APIError } from '@/lib/api'
import { DOC_TYPE_LABELS } from '@/components/result/DocumentProfileCard'
import type { SavedExtractionSummary } from '@/lib/types'

const HITL_CONFIG = {
  not_required: { label: 'Passed', className: 'badge-success' },
  recommended: { label: 'Review', className: 'badge-warning' },
  required: { label: 'Required', className: 'badge-error' },
} as const

interface HistoryTableProps {
  extractions: SavedExtractionSummary[]
  onDeleted: (id: string) => void
}

export function HistoryTable({ extractions, onDeleted }: HistoryTableProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (extractions.length === 0) {
    return (
      <div className="rounded-xl border border-dome-border bg-dome-surface flex flex-col items-center justify-center py-16 gap-3">
        <FileText size={32} strokeWidth={1} className="text-dome-muted" />
        <p className="text-sm text-dome-muted">No saved documents yet.</p>
        <button onClick={() => router.push('/')} className="btn btn-secondary btn-sm mt-1">
          Upload a document
        </button>
      </div>
    )
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this saved extraction?')) return
    setDeletingId(id)
    try {
      await deleteSavedExtraction(id)
      onDeleted(id)
    } catch (err) {
      alert(err instanceof APIError ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="table-wrapper">
      <table className="dome-table">
        <thead>
          <tr>
            <th>Document</th>
            <th>Type</th>
            <th>Industry</th>
            <th>Confidence</th>
            <th>Review</th>
            <th>Saved</th>
            <th style={{ width: 80 }} />
          </tr>
        </thead>
        <tbody>
          {extractions.map(ex => {
            const hitl = HITL_CONFIG[ex.human_in_loop as keyof typeof HITL_CONFIG] ?? { label: ex.human_in_loop, className: 'badge-neutral' }
            const docLabel = DOC_TYPE_LABELS[ex.doc_type] ?? ex.doc_type.replace(/_/g, ' ')
            return (
              <tr key={ex.id}>
                <td>
                  <span className="text-sm font-medium text-dome-text truncate max-w-xs block">
                    {ex.filename ?? <span className="text-dome-muted italic">camera capture</span>}
                  </span>
                </td>
                <td>
                  <span className="text-sm text-dome-text capitalize">{docLabel}</span>
                </td>
                <td>
                  <span className="text-sm text-dome-muted capitalize">
                    {ex.industry_hint ? ex.industry_hint.replace(/_/g, ' ') : '—'}
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
                    {new Date(ex.saved_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => router.push(`/result?id=${ex.id}`)}
                      className="btn btn-ghost btn-sm p-1.5"
                      title="View"
                    >
                      <Eye size={14} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => handleDelete(ex.id)}
                      disabled={deletingId === ex.id}
                      className="btn btn-ghost btn-sm p-1.5 text-dome-muted hover:text-dome-error"
                      title="Delete"
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
