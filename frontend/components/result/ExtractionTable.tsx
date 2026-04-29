import { FileDown } from 'lucide-react'
import type { ExtractedField } from '@/lib/types'
import { ConfidencePill } from './ConfidencePill'

interface ExtractionTableProps {
  fields: ExtractedField[]
}

const TYPE_LABELS: Record<string, string> = {
  currency: 'Currency',
  date: 'Date',
  text: 'Text',
  identifier: 'Identifier',
  percentage: 'Percentage',
}

function exportCSV(fields: ExtractedField[]) {
  const headers = ['Field', 'Value', 'Section', 'Type', 'Confidence', 'Critical']
  const rows = fields.map(f => [
    f.name,
    f.value ?? '',
    f.location_hint ?? '',
    f.data_type,
    `${Math.round(f.confidence * 100)}%`,
    f.is_critical ? 'Yes' : 'No',
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
  if (fields.length === 0) {
    return (
      <div className="text-center py-12 text-dome-muted text-sm">
        No fields extracted.
      </div>
    )
  }

  return (
    <div>
      <div className="table-wrapper">
        <table className="dome-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Value</th>
              <th>Section</th>
              <th>Type</th>
              <th>Confidence</th>
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
                        Critical
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span className="text-dome-text text-sm">
                    {field.value ?? <span className="text-dome-muted italic">empty</span>}
                  </span>
                </td>
                <td>
                  {field.location_hint ? (
                    <span className="text-xs text-dome-muted capitalize">
                      {field.location_hint.replace(/_/g, ' ')}
                    </span>
                  ) : (
                    <span className="text-dome-border">—</span>
                  )}
                </td>
                <td>
                  <span className="badge badge-neutral" style={{ fontSize: '0.625rem' }}>
                    {TYPE_LABELS[field.data_type] ?? field.data_type}
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
            <span className="badge badge-error" style={{ fontSize: '0.5625rem', padding: '2px 5px' }}>Critical</span>
            essential to document purpose
          </span>
          <span>
            Confidence: <span style={{ color: 'var(--color-success)' }}>high ≥85%</span>
            {' · '}<span style={{ color: 'var(--color-warning)' }}>moderate 60–84%</span>
            {' · '}<span style={{ color: 'var(--color-error)' }}>low &lt;60%</span>
          </span>
        </div>
        <button
          onClick={() => exportCSV(fields)}
          className="flex items-center gap-1.5 text-xs text-dome-muted hover:text-dome-text transition-colors"
          title="Export to CSV (opens in Excel)"
        >
          <FileDown size={13} strokeWidth={1.5} />
          Export CSV
        </button>
      </div>
    </div>
  )
}
