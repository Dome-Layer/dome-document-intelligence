'use client'

import type { GovernanceEvent } from '@/lib/types'
import { ConfidencePill } from '@/components/result/ConfidencePill'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useIntlLocale, useT } from '@/lib/i18n'
import { labelFor } from '@/lib/labels'

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
  const t = useT()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-dome-muted text-sm">
        {t.audit.empty}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="table-wrapper">
        <table className="dome-table">
          <thead>
            <tr>
              <th>{t.audit.columns.timestamp}</th>
              <th>{t.audit.columns.docType}</th>
              <th>{t.audit.columns.fields}</th>
              <th>{t.audit.columns.flags}</th>
              <th>{t.audit.columns.confidence}</th>
              <th>{t.audit.columns.review}</th>
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
            {t.audit.summary(total, page, totalPages)}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="btn btn-neutral btn-sm"
              style={{ padding: '6px 10px', gap: 0 }}
              aria-label={t.audit.previous}
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="btn btn-neutral btn-sm"
              style={{ padding: '6px 10px', gap: 0 }}
              aria-label={t.audit.next}
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
  const t = useT()
  const intlLocale = useIntlLocale()
  const ts = new Date(event.timestamp)
  const dateStr = ts.toLocaleDateString(intlLocale, { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = ts.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit' })

  const docType = (event.metadata?.doc_type as string | undefined) ?? event.action_type
  const fieldCount = (event.metadata?.field_count as number | undefined) ?? t.audit.none

  const flagCount = event.rules_triggered.length
  const hitlStatus = event.human_in_loop

  return (
    <tr>
      <td>
        <p className="text-sm text-dome-text">{dateStr}</p>
        <p className="text-xs text-dome-muted">{timeStr}</p>
      </td>
      <td>
        <span className="text-sm text-dome-text">
          {labelFor(t.docTypes, docType)}
        </span>
      </td>
      <td>
        <span className="text-sm text-dome-text">{fieldCount}</span>
      </td>
      <td>
        {flagCount > 0 ? (
          <span className="badge badge-error">{t.audit.flagCount(flagCount)}</span>
        ) : (
          <span className="badge badge-success">{t.audit.noFlags}</span>
        )}
      </td>
      <td>
        {event.confidence !== null && event.confidence !== undefined ? (
          <ConfidencePill value={event.confidence} />
        ) : (
          <span className="text-sm text-dome-muted">{t.audit.none}</span>
        )}
      </td>
      <td>
        {hitlStatus === 'required' && (
          <span className="badge badge-error">{t.review.status.required}</span>
        )}
        {hitlStatus === 'recommended' && (
          <span className="badge badge-warning">{t.review.status.recommended}</span>
        )}
        {(hitlStatus === 'not_required' || !hitlStatus) && (
          <span className="badge badge-success">{t.review.status.not_required}</span>
        )}
      </td>
    </tr>
  )
}
