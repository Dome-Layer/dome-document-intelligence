'use client'

import type { GovernanceEvent } from '@/lib/types'
import { ConfidencePill } from '@/components/result/ConfidencePill'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface AuditLogTableProps {
  events: GovernanceEvent[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
}

export function AuditLogTable({
  events,
  total,
  page,
  pageSize,
  onPageChange,
}: AuditLogTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-dome-muted text-sm">
        No audit events yet. Process a document to generate an event.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="table-wrapper">
        <table className="dome-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Document type</th>
              <th>Fields</th>
              <th>Flags triggered</th>
              <th>Confidence</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, i) => (
              <EventRow key={event.id ?? i} event={event} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-dome-muted">
            {total} event{total !== 1 ? 's' : ''} · Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="btn btn-neutral btn-sm"
              style={{ padding: '6px 10px', gap: 0 }}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="btn btn-neutral btn-sm"
              style={{ padding: '6px 10px', gap: 0 }}
              aria-label="Next page"
            >
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EventRow({ event }: { event: GovernanceEvent }) {
  const ts = new Date(event.timestamp)
  const dateStr = ts.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const docType = (event.metadata?.doc_type as string | undefined) ?? event.action_type
  const fieldCount = (event.metadata?.field_count as number | undefined) ?? '—'

  const flagCount = event.rules_triggered.length
  const hitlStatus = event.human_in_loop

  return (
    <tr>
      <td>
        <p className="text-sm text-dome-text">{dateStr}</p>
        <p className="text-xs text-dome-muted">{timeStr}</p>
      </td>
      <td>
        <span className="text-sm text-dome-text capitalize">
          {docType.replace(/_/g, ' ')}
        </span>
      </td>
      <td>
        <span className="text-sm text-dome-text">{fieldCount}</span>
      </td>
      <td>
        {flagCount > 0 ? (
          <span className="badge badge-error">{flagCount} flag{flagCount !== 1 ? 's' : ''}</span>
        ) : (
          <span className="badge badge-success">None</span>
        )}
      </td>
      <td>
        {event.confidence !== null && event.confidence !== undefined ? (
          <ConfidencePill value={event.confidence} />
        ) : (
          <span className="text-sm text-dome-muted">—</span>
        )}
      </td>
      <td>
        {hitlStatus === 'required' && (
          <span className="badge badge-error">Required</span>
        )}
        {hitlStatus === 'recommended' && (
          <span className="badge badge-warning">Recommended</span>
        )}
        {(hitlStatus === 'not_required' || !hitlStatus) && (
          <span className="badge badge-success">Not required</span>
        )}
      </td>
    </tr>
  )
}
