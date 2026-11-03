'use client'

import { AlertCircle, AlertTriangle } from 'lucide-react'
import { useT } from '@/lib/i18n'

interface HumanInLoopBannerProps {
  status: 'not_required' | 'recommended' | 'required'
}

export function HumanInLoopBanner({ status }: HumanInLoopBannerProps) {
  const t = useT()
  if (status === 'not_required') return null

  const isRequired = status === 'required'

  return (
    <div
      className={`rounded-xl border px-5 py-4 flex items-start gap-4 ${
        isRequired
          ? 'bg-dome-error-subtle border-dome-error-border'
          : 'bg-dome-warning-subtle border-dome-warning-border'
      }`}
    >
      {isRequired ? (
        <AlertCircle
          size={20}
          strokeWidth={1.5}
          className="text-dome-error flex-shrink-0 mt-0.5"
        />
      ) : (
        <AlertTriangle
          size={20}
          strokeWidth={1.5}
          className="text-dome-warning flex-shrink-0 mt-0.5"
        />
      )}
      <div>
        <p className={`text-sm font-semibold ${isRequired ? 'text-dome-error' : 'text-dome-warning'}`}>
          {isRequired ? t.review.requiredTitle : t.review.recommendedTitle}
        </p>
        <p className="text-sm text-dome-muted mt-0.5">
          {isRequired ? t.review.requiredBody : t.review.recommendedBody}
        </p>
      </div>
    </div>
  )
}
