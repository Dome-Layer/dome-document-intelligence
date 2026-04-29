import { AlertCircle, AlertTriangle } from 'lucide-react'

interface HumanInLoopBannerProps {
  status: 'not_required' | 'recommended' | 'required'
}

export function HumanInLoopBanner({ status }: HumanInLoopBannerProps) {
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
          {isRequired ? 'Human review required' : 'Human review recommended'}
        </p>
        <p className="text-sm text-dome-muted mt-0.5">
          {isRequired
            ? 'One or more critical governance rules were triggered. This extraction must be reviewed by a human before use.'
            : 'One or more warnings were raised. Review this extraction before relying on it for decisions.'}
        </p>
      </div>
    </div>
  )
}
