'use client'

import { FileDown } from 'lucide-react'
import type { ExtractedField } from '@/lib/types'
import { useFmt, useT } from '@/lib/i18n'
import { humanize, labelFor } from '@/lib/labels'
import type { Fmt, Messages } from '@/lib/messages'
import { ConfidencePill } from './ConfidencePill'

interface ExtractionTableProps {
  fields: ExtractedField[]
}

/** Headers and yes/no in the visitor's language; field names, values and data types stay as extracted. */
function exportCSV(fields: ExtractedField[], t: Messages, fmt: Fmt) {
  const headers = t.table.csvHeaders
  const rows = fields.map(f => [
    f.name,
    f.value ?? '',
    f.location_hint ?? '',
    f.data_type,
    fmt.pct(f.confidence),
    f.is_critical ? t.table.yes : t.table.no,
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `extracted_fields_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ExtractionTable({ fields }: ExtractionTableProps) {
  const t = useT()
  const fmt = useFmt()
  if (fields.length === 0) {
    return (
      <div className="text-center py-12 text-dome-muted text-sm">
        {t.table.noFields}
      </div>
    )
  }

  return (
    <div>
      <div className="table-wrapper">
        <table className="dome-table">
          <thead>
            <tr>
              <th>{t.table.field}</th>
              <th>{t.table.value}</th>
              <th>{t.table.section}</th>
              <th>{t.table.type}</th>
              <th>{t.table.confidence}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, i) => (
              <tr key={i}>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-dome-text" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                      {field.name}
                    </span>
                    {field.is_critical && (
                      <span className="badge badge-error" style={{ fontSize: '0.5625rem', padding: '2px 5px' }}>
                        {t.table.critical}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span className="text-dome-text text-sm">
                    {field.value ?? <span className="text-dome-muted italic">{t.table.empty}</span>}
                  </span>
                </td>
                <td>
                  {field.location_hint ? (
                    <span className="text-xs text-dome-muted">
                      {humanize(field.location_hint)}
                    </span>
                  ) : (
                    <span className="text-dome-muted">{t.table.none}</span>
                  )}
                </td>
                <td>
                  <span className="badge badge-neutral" style={{ fontSize: '0.625rem' }}>
                    {labelFor(t.dataTypes, field.data_type)}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 rounded-full bg-dome-border flex-shrink-0"
                      style={{ width: 48 }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round(field.confidence * 100)}%`,
                          background: field.confidence >= 0.85
                            ? 'var(--color-success)'
                            : field.confidence >= 0.6
                            ? 'var(--color-warning)'
                            : 'var(--color-error)',
                        }}
                      />
                    </div>
                    <ConfidencePill value={field.confidence} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mt-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-dome-muted">
          <span className="flex items-center gap-1.5">
            <span className="badge badge-error" style={{ fontSize: '0.5625rem', padding: '2px 5px' }}>{t.table.critical}</span>
            {t.table.criticalLegend}
          </span>
          <span>
            {t.table.confidenceLegend} <span style={{ color: 'var(--color-success)' }}>{t.table.high}</span>
            {' · '}<span style={{ color: 'var(--color-warning)' }}>{t.table.moderate}</span>
            {' · '}<span style={{ color: 'var(--color-error)' }}>{t.table.low}</span>
          </span>
        </div>
        <button
          onClick={() => exportCSV(fields, t, fmt)}
          className="flex items-center gap-1.5 text-xs text-dome-muted hover:text-dome-text transition-colors"
          title={t.table.exportTitle}
        >
          <FileDown size={13} strokeWidth={1.5} />
          {t.table.exportCsv}
        </button>
      </div>
    </div>
  )
}
