'use client'

import type { DocumentProfile } from '@/lib/types'
import { useFmt, useT } from '@/lib/i18n'
import { humanize, labelFor } from '@/lib/labels'
import { ConfidencePill } from './ConfidencePill'

interface DocumentProfileCardProps {
  profile: DocumentProfile
  overallConfidence: number
}

export function DocumentProfileCard({ profile, overallConfidence }: DocumentProfileCardProps) {
  const t = useT()
  const f = useFmt()
  const docLabel = labelFor(t.docTypes, profile.doc_type)
  const languageName = f.language(profile.language)

  return (
    <div className="rounded-xl border border-dome-border bg-dome-surface p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-1">{t.profile.eyebrow}</p>
          <h2 className="text-lg font-semibold text-dome-text" style={{ letterSpacing: '-0.01em' }}>
            {docLabel}
          </h2>
        </div>
        <ConfidencePill value={overallConfidence} />
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ProfileField label={t.profile.type} value={docLabel} />
        {profile.industry_hint && (
          <ProfileField label={t.profile.industry} value={labelFor(t.industries, profile.industry_hint)} />
        )}
        <ProfileField
          label={t.profile.language}
          value={languageName.charAt(0).toLocaleUpperCase() + languageName.slice(1)}
        />
        {profile.currency && (
          <ProfileField label={t.profile.currency} value={profile.currency} />
        )}
      </div>

      {profile.sections.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-dome-muted font-medium uppercase tracking-wider mb-2" style={{ fontSize: '0.6875rem', letterSpacing: '0.1em' }}>
            {t.profile.sections}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {/* Section names come from the document as the model read it, so they are not translated. */}
            {profile.sections.map(s => (
              <span key={s} className="badge badge-neutral" style={{ textTransform: 'none' }}>
                {humanize(s)}
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
      <p className="text-sm font-medium text-dome-text">{value}</p>
    </div>
  )
}
