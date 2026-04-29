import type { DocumentProfile } from '@/lib/types'
import { ConfidencePill } from './ConfidencePill'

interface DocumentProfileCardProps {
  profile: DocumentProfile
  overallConfidence: number
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: 'Invoice',
  purchase_order: 'Purchase order',
  utility_bill: 'Utility bill',
  trade_confirmation: 'Trade confirmation',
  letter_of_credit: 'Letter of credit',
  contract: 'Contract',
  commodity_report: 'Commodity report',
  lab_report: 'Lab report',
  medical_record: 'Medical record',
  clinical_form: 'Clinical form',
  prescription: 'Prescription',
  bank_statement: 'Bank statement',
  tax_form: 'Tax form',
  cv_resume: 'CV / Résumé',
  other: 'Other',
}

export function DocumentProfileCard({ profile, overallConfidence }: DocumentProfileCardProps) {
  const docLabel = DOC_TYPE_LABELS[profile.doc_type] ?? profile.doc_type.replace(/_/g, ' ')

  return (
    <div className="rounded-xl border border-dome-border bg-dome-surface p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-1">Document profile</p>
          <h2 className="text-lg font-semibold text-dome-text" style={{ letterSpacing: '-0.01em' }}>
            {docLabel}
          </h2>
        </div>
        <ConfidencePill value={overallConfidence} />
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ProfileField label="Type" value={docLabel} />
        {profile.industry_hint && (
          <ProfileField label="Industry" value={profile.industry_hint.replace(/_/g, ' ')} />
        )}
        <ProfileField label="Language" value={profile.language.toUpperCase()} />
        {profile.currency && (
          <ProfileField label="Currency" value={profile.currency} />
        )}
      </div>

      {profile.sections.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-dome-muted font-medium uppercase tracking-wider mb-2" style={{ fontSize: '0.6875rem', letterSpacing: '0.1em' }}>
            Sections detected
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.sections.map(s => (
              <span key={s} className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                {s.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-dome-muted font-medium uppercase tracking-wider mb-0.5" style={{ fontSize: '0.6875rem', letterSpacing: '0.1em' }}>
        {label}
      </p>
      <p className="text-sm font-medium text-dome-text capitalize">{value}</p>
    </div>
  )
}
